import { prisma } from "../../../helpers/prisma.js";
import { racingApiGateway } from "../../../sync/racing-api.gateway.js";

// Helper to compute power score
function calculatePower(
  total: number,
  first: number,
  second: number,
  third: number,
  fourth: number
): number {
  if (!total || total <= 0) return 0;
  return (first * 4 + second * 3 + third * 2 + fourth * 1) / total;
}

export class EnrichmentService {
  // ─────────────────────────────────────────────────────────────────────────────
  // HORSE ENRICHMENT
  // ─────────────────────────────────────────────────────────────────────────────
  static async enrichHorse(horseId: string, externalId: string): Promise<boolean> {
    try {
      console.log(`[Enrichment] Enriching horse: ${horseId} (API ID: ${externalId})`);

      // 1. Fetch Pro profile
      const profile = await racingApiGateway.fetchHorseProProfile(externalId);
      
      // 2. Fetch career results (for wins/runs calculation)
      const resultsData = await racingApiGateway.fetchHorseResults(externalId, 100);
      const results: any[] = resultsData?.results ?? [];

      const totalRaces = results.length;
      const wins = results.filter((r) => parseInt(r.position, 10) === 1).length;
      const seconds = results.filter((r) => parseInt(r.position, 10) === 2).length;
      const thirds = results.filter((r) => parseInt(r.position, 10) === 3).length;
      const fourths = results.filter((r) => parseInt(r.position, 10) === 4).length;

      let totalEarnings = 0;
      results.forEach((r) => {
        const prize = r.prize ? parseFloat(r.prize.toString().replace(/[^0-9.]/g, "")) : 0;
        if (prize > 0) {
          const pos = parseInt(r.position, 10);
          if (pos === 1) totalEarnings += prize * 0.60;
          else if (pos === 2) totalEarnings += prize * 0.20;
          else if (pos === 3) totalEarnings += prize * 0.12;
          else if (pos === 4) totalEarnings += prize * 0.08;
        }
      });

      // 3. Fetch distance analysis
      let distanceAnalysis = null;
      try {
        distanceAnalysis = await racingApiGateway.fetchHorseDistanceTimesAnalysis(externalId);
      } catch (e) {}

      // 4. Update Horse
      await prisma.horse.update({
        where: { id: horseId },
        data: {
          age: profile.dob ? new Date().getFullYear() - new Date(profile.dob).getFullYear() : undefined,
          sex: profile.sex || undefined,
          sexCode: profile.sex_code || undefined,
          dob: profile.dob || undefined,
          breeder: profile.breeder || undefined,
          sireId: profile.sire_id?.toString() || undefined,
          damId: profile.dam_id?.toString() || undefined,
          damSireId: profile.damsire_id?.toString() || undefined,
          totalRaces,
          wins,
          seconds,
          thirds,
          fourths,
          totalEarnings,
          distanceAnalysis: distanceAnalysis || undefined,
          enrichedAt: new Date(),
          enrichedSource: "api",
        },
      });

      // 5. Recursively enrich Sire / Dam / DamSire if external ID is retrieved
      if (profile.sire_id && profile.sire) {
        await EnrichmentService.enrichSire(profile.sire_id.toString(), profile.sire);
      }
      if (profile.dam_id && profile.dam) {
        await EnrichmentService.enrichDam(profile.dam_id.toString(), profile.dam);
      }
      if (profile.damsire_id && profile.damsire) {
        await EnrichmentService.enrichDamSire(profile.damsire_id.toString(), profile.damsire);
      }

      return true;
    } catch (error: any) {
      console.error(`[Enrichment] Failed to enrich horse ${horseId}:`, error.message);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PEDIGREE ENRICHMENT (Sire / Dam / DamSire)
  // ─────────────────────────────────────────────────────────────────────────────
  static async enrichSire(externalId: string, name: string): Promise<boolean> {
    try {
      let sire = await prisma.sire.findUnique({ where: { name } });
      if (!sire) {
        sire = await prisma.sire.create({ data: { name, externalId } });
      }

      // Fetch offspring results
      const resultsData = await racingApiGateway.fetchSireResults(externalId, 100);
      const results: any[] = resultsData?.results ?? [];

      const totalOffspring = results.length;
      const wins = results.filter((r) => parseInt(r.position, 10) === 1).length;
      const seconds = results.filter((r) => parseInt(r.position, 10) === 2).length;
      const thirds = results.filter((r) => parseInt(r.position, 10) === 3).length;
      const fourths = results.filter((r) => parseInt(r.position, 10) === 4).length;

      const power = calculatePower(totalOffspring, wins, seconds, thirds, fourths);

      let distanceAnalysis = null;
      try {
        distanceAnalysis = await racingApiGateway.fetchSireDistanceAnalysis(externalId);
      } catch (e) {}

      let classAnalysis = null;
      try {
        classAnalysis = await racingApiGateway.fetchSireClassAnalysis(externalId);
      } catch (e) {}

      await prisma.sire.update({
        where: { id: sire.id },
        data: {
          externalId,
          totalOffspring,
          wins,
          seconds,
          thirds,
          fourths,
          winRate: totalOffspring > 0 ? wins / totalOffspring : 0,
          placeRate: totalOffspring > 0 ? (wins + seconds + thirds) / totalOffspring : 0,
          power,
          distanceAnalysis: distanceAnalysis || undefined,
          classAnalysis: classAnalysis || undefined,
          enrichedAt: new Date(),
        },
      });

      // Update all horses that have this sire
      await prisma.horse.updateMany({
        where: { sireName: name },
        data: { sirePower: power, sireModelId: sire.id },
      });

      return true;
    } catch (e: any) {
      console.error(`[PedigreeEnrichment] Sire ${name} failed:`, e.message);
      return false;
    }
  }

  static async enrichDam(externalId: string, name: string): Promise<boolean> {
    try {
      let dam = await prisma.dam.findUnique({ where: { name } });
      if (!dam) {
        dam = await prisma.dam.create({ data: { name, externalId } });
      }

      const resultsData = await racingApiGateway.fetchDamResults(externalId, 100);
      const results: any[] = resultsData?.results ?? [];

      const totalProgeny = results.length;
      const wins = results.filter((r) => parseInt(r.position, 10) === 1).length;
      const seconds = results.filter((r) => parseInt(r.position, 10) === 2).length;
      const thirds = results.filter((r) => parseInt(r.position, 10) === 3).length;
      const fourths = results.filter((r) => parseInt(r.position, 10) === 4).length;

      const power = calculatePower(totalProgeny, wins, seconds, thirds, fourths);

      let distanceAnalysis = null;
      try {
        distanceAnalysis = await racingApiGateway.fetchDamDistanceAnalysis(externalId);
      } catch (e) {}

      let classAnalysis = null;
      try {
        classAnalysis = await racingApiGateway.fetchDamClassAnalysis(externalId);
      } catch (e) {}

      await prisma.dam.update({
        where: { id: dam.id },
        data: {
          externalId,
          totalProgeny,
          wins,
          seconds,
          thirds,
          fourths,
          winRate: totalProgeny > 0 ? wins / totalProgeny : 0,
          placeRate: totalProgeny > 0 ? (wins + seconds + thirds) / totalProgeny : 0,
          power,
          distanceAnalysis: distanceAnalysis || undefined,
          classAnalysis: classAnalysis || undefined,
          enrichedAt: new Date(),
        },
      });

      await prisma.horse.updateMany({
        where: { damName: name },
        data: { damPower: power, damModelId: dam.id },
      });

      return true;
    } catch (e: any) {
      console.error(`[PedigreeEnrichment] Dam ${name} failed:`, e.message);
      return false;
    }
  }

  static async enrichDamSire(externalId: string, name: string): Promise<boolean> {
    try {
      let damSire = await prisma.damSire.findUnique({ where: { name } });
      if (!damSire) {
        damSire = await prisma.damSire.create({ data: { name, externalId } });
      }

      const resultsData = await racingApiGateway.fetchDamSireResults(externalId, 100);
      const results: any[] = resultsData?.results ?? [];

      const totalOffspring = results.length;
      const wins = results.filter((r) => parseInt(r.position, 10) === 1).length;
      const seconds = results.filter((r) => parseInt(r.position, 10) === 2).length;
      const thirds = results.filter((r) => parseInt(r.position, 10) === 3).length;
      const fourths = results.filter((r) => parseInt(r.position, 10) === 4).length;

      const power = calculatePower(totalOffspring, wins, seconds, thirds, fourths);

      let distanceAnalysis = null;
      try {
        distanceAnalysis = await racingApiGateway.fetchDamSireDistanceAnalysis(externalId);
      } catch (e) {}

      let classAnalysis = null;
      try {
        classAnalysis = await racingApiGateway.fetchDamSireClassAnalysis(externalId);
      } catch (e) {}

      await prisma.damSire.update({
        where: { id: damSire.id },
        data: {
          externalId,
          totalOffspring,
          wins,
          seconds,
          thirds,
          fourths,
          winRate: totalOffspring > 0 ? wins / totalOffspring : 0,
          placeRate: totalOffspring > 0 ? (wins + seconds + thirds) / totalOffspring : 0,
          power,
          distanceAnalysis: distanceAnalysis || undefined,
          classAnalysis: classAnalysis || undefined,
          enrichedAt: new Date(),
        },
      });

      await prisma.horse.updateMany({
        where: { damSireName: name },
        data: { damSirePower: power, damSireModelId: damSire.id },
      });

      return true;
    } catch (e: any) {
      console.error(`[PedigreeEnrichment] DamSire ${name} failed:`, e.message);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // JOCKEY ENRICHMENT
  // ─────────────────────────────────────────────────────────────────────────────
  static async enrichJockey(jockeyId: string, externalId: string): Promise<boolean> {
    try {
      console.log(`[Enrichment] Enriching jockey: ${jockeyId}`);

      const resultsData = await racingApiGateway.fetchJockeyResults(externalId, 100);
      const results: any[] = resultsData?.results ?? [];

      const totalRides = results.length;
      const wins = results.filter((r) => parseInt(r.position, 10) === 1).length;
      const seconds = results.filter((r) => parseInt(r.position, 10) === 2).length;
      const thirds = results.filter((r) => parseInt(r.position, 10) === 3).length;
      const fourths = results.filter((r) => parseInt(r.position, 10) === 4).length;

      // 30 days form
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const results30d = results.filter((r) => new Date(r.date) >= thirtyDaysAgo);
      const ridesLast30d = results30d.length;
      const winsLast30d = results30d.filter((r) => parseInt(r.position, 10) === 1).length;

      // Course, distance, trainer analyses
      let courseAnalysis = null;
      try { courseAnalysis = await racingApiGateway.fetchJockeyCourseAnalysis(externalId); } catch (e) {}

      let distanceAnalysis = null;
      try { distanceAnalysis = await racingApiGateway.fetchJockeyDistanceAnalysis(externalId); } catch (e) {}

      let trainerAnalysis = null;
      try { trainerAnalysis = await racingApiGateway.fetchJockeyTrainerAnalysis(externalId); } catch (e) {}

      let ownerAnalysis = null;
      try { ownerAnalysis = await racingApiGateway.fetchJockeyOwnerAnalysis(externalId); } catch (e) {}

      await prisma.jockey.update({
        where: { id: jockeyId },
        data: {
          totalRides,
          wins,
          seconds,
          thirds,
          fourths,
          ridesLast30d,
          winsLast30d,
          courseAnalysis: courseAnalysis || undefined,
          distanceAnalysis: distanceAnalysis || undefined,
          trainerAnalysis: trainerAnalysis || undefined,
          ownerAnalysis: ownerAnalysis || undefined,
          enrichedAt: new Date(),
          enrichedSource: "api",
        },
      });

      return true;
    } catch (e: any) {
      console.error(`[Enrichment] Failed to enrich jockey ${jockeyId}:`, e.message);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TRAINER ENRICHMENT
  // ─────────────────────────────────────────────────────────────────────────────
  static async enrichTrainer(trainerId: string, externalId: string): Promise<boolean> {
    try {
      console.log(`[Enrichment] Enriching trainer: ${trainerId}`);

      const resultsData = await racingApiGateway.fetchTrainerResults(externalId, 100);
      const results: any[] = resultsData?.results ?? [];

      const totalRuns = results.length;
      const wins = results.filter((r) => parseInt(r.position, 10) === 1).length;
      const seconds = results.filter((r) => parseInt(r.position, 10) === 2).length;
      const thirds = results.filter((r) => parseInt(r.position, 10) === 3).length;
      const fourths = results.filter((r) => parseInt(r.position, 10) === 4).length;

      // 30 days form
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const results30d = results.filter((r) => new Date(r.date) >= thirtyDaysAgo);
      const runsLast30d = results30d.length;
      const winsLast30d = results30d.filter((r) => parseInt(r.position, 10) === 1).length;

      // Analyses
      let courseAnalysis = null;
      try { courseAnalysis = await racingApiGateway.fetchTrainerCourseAnalysis(externalId); } catch (e) {}

      let distanceAnalysis = null;
      try { distanceAnalysis = await racingApiGateway.fetchTrainerDistanceAnalysis(externalId); } catch (e) {}

      let jockeyAnalysis = null;
      try { jockeyAnalysis = await racingApiGateway.fetchTrainerJockeyAnalysis(externalId); } catch (e) {}

      let horseAgeAnalysis = null;
      try { horseAgeAnalysis = await racingApiGateway.fetchTrainerHorseAgeAnalysis(externalId); } catch (e) {}

      await prisma.trainer.update({
        where: { id: trainerId },
        data: {
          totalRuns,
          wins,
          seconds,
          thirds,
          fourths,
          runsLast30d,
          winsLast30d,
          courseAnalysis: courseAnalysis || undefined,
          distanceAnalysis: distanceAnalysis || undefined,
          jockeyAnalysis: jockeyAnalysis || undefined,
          horseAgeAnalysis: horseAgeAnalysis || undefined,
          enrichedAt: new Date(),
          enrichedSource: "api",
        },
      });

      return true;
    } catch (e: any) {
      console.error(`[Enrichment] Failed to enrich trainer ${trainerId}:`, e.message);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ODDS ENRICHMENT
  // ─────────────────────────────────────────────────────────────────────────────
  static async syncOdds(raceId: string, externalId: string): Promise<boolean> {
    try {
      console.log(`[OddsSync] Syncing odds for race: ${raceId} (API ID: ${externalId})`);

      const oddsData = await racingApiGateway.fetchOdds(externalId);
      const bookmakerOdds = oddsData?.odds ?? {};

      // Delete existing odds for this race to keep fresh
      await prisma.odds.deleteMany({ where: { raceId } });

      const entries = await prisma.raceEntry.findMany({
        where: { raceId },
        include: { horse: true },
      });

      for (const entry of entries) {
        const horseName = entry.horse.name.trim().toLowerCase();
        
        // Find matching runner in odds response (key is often horse name)
        let matchedKey = Object.keys(bookmakerOdds).find(
          (k) => k.trim().toLowerCase() === horseName
        );

        if (matchedKey) {
          const runnerOdds = bookmakerOdds[matchedKey];
          // runnerOdds is an object with bookmaker keys e.g. { "BetFair": 4.5, "William Hill": 4.0, "sp": "3/1" }
          for (const bookie of Object.keys(runnerOdds)) {
            let winOdds: number | null = null;
            let sp: number | null = null;

            const val = runnerOdds[bookie];
            if (bookie === "sp") {
              // Parse fractional SP e.g. "3/1" or "10/11"
              if (typeof val === "string" && val.includes("/")) {
                const [num, den] = val.split("/").map(Number);
                if (num && den) sp = num / den + 1; // decimal SP
              } else {
                sp = parseFloat(val) || null;
              }
            } else {
              winOdds = parseFloat(val) || null;
            }

            if (winOdds != null || sp != null) {
              await prisma.odds.create({
                data: {
                  raceId,
                  horseId: entry.horse.externalId,
                  horseName: entry.horse.name,
                  bookmaker: bookie,
                  winOdds,
                  sp,
                  source: "theracingapi",
                },
              });

              // Also write to history
              await prisma.oddsHistory.create({
                data: {
                  raceId,
                  horseId: entry.horse.externalId,
                  horseName: entry.horse.name,
                  bookmaker: bookie,
                  winOdds,
                },
              });
            }
          }
        }
      }

      await prisma.race.update({
        where: { id: raceId },
        data: { oddsSyncedAt: new Date() },
      });

      return true;
    } catch (e: any) {
      console.error(`[OddsSync] Failed to sync odds for race ${raceId}:`, e.message);
      return false;
    }
  }
}
