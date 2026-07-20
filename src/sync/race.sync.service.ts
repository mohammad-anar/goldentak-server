import { RaceStatus, Category } from "@prisma/client";
import { prisma } from "../helpers/prisma.js";
import { racingApiGateway } from "./racing-api.gateway.js";
import { CacheService } from "../cache/cache.service.js";
import { Queues, JOB_NAMES } from "../queues/queue.registry.js";

// Helper to map region codes to country names
function getCountryName(region: string): string {
  const mapping: Record<string, string> = {
    gb: "United Kingdom",
    ire: "Ireland",
    usa: "United States",
    aus: "Australia",
    fr: "France",
    za: "South Africa",
    uae: "United Arab Emirates",
  };
  return mapping[region.toLowerCase()] || "United Kingdom";
}

function parseWeight(weightStr: string | null | undefined): number {
  if (!weightStr) return 0;
  const numeric = Number(weightStr);
  if (!isNaN(numeric)) return numeric;
  const parts = weightStr.split("-");
  if (parts.length === 2) {
    const stones = parseInt(parts[0], 10);
    const lbs    = parseInt(parts[1], 10);
    if (!isNaN(stones) && !isNaN(lbs)) return stones * 14 + lbs;
  }
  return parseFloat(weightStr) || 0;
}

function mapStatus(apiStatus: string): RaceStatus {
  if (apiStatus === "finished") return "FINISHED";
  if (apiStatus === "live" || apiStatus === "off") return "LIVE";
  return "UPCOMING";
}

export interface RaceSyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  durationMs: number;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RaceSyncService
//
// Single responsibility: sync racecards from Racing API → PostgreSQL.
// Supports multi-region (read from RACING_API_REGIONS env variable).
// ─────────────────────────────────────────────────────────────────────────────
export class RaceSyncService {
  static async syncUpcoming(days = 3): Promise<RaceSyncResult> {
    const start = Date.now();
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    const regions = (process.env.RACING_API_REGIONS || "gb,ire")
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter((r) => r.length > 0);

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      for (const region of regions) {
        try {
          console.log(`[RaceSync] Syncing upcoming races for region: ${region}, date: ${dateStr}`);
          const data = await racingApiGateway.fetchRacecardsForDate(dateStr, region);
          const racecards: any[] = data?.racecards ?? [];

          for (const card of racecards) {
            try {
              const status = mapStatus(card.race_status ?? "upcoming");
              const result = await RaceSyncService._upsertRacecard(card, status, region);
              if (result === "created") created++;
              else updated++;
            } catch (err: any) {
              errors.push(`Race ${card.race_id} (${region}): ${err.message}`);
            }
          }
        } catch (err: any) {
          errors.push(`Region ${region} date ${dateStr}: ${err.message}`);
        }
      }
    }

    await CacheService.invalidateRace();
    return {
      success: errors.length === 0,
      created,
      updated,
      skipped: 0,
      durationMs: Date.now() - start,
      errors,
    };
  }

  static async syncResults(days = 3): Promise<RaceSyncResult> {
    const start = Date.now();
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    const regions = (process.env.RACING_API_REGIONS || "gb,ire")
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter((r) => r.length > 0);

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      for (const region of regions) {
        try {
          console.log(`[RaceSync] Syncing race results for region: ${region}, date: ${dateStr}`);
          const data = await racingApiGateway.fetchResults(dateStr, region);
          const results: any[] = data?.results ?? [];

          for (const card of results) {
            try {
              const result = await RaceSyncService._upsertRacecard(card, "FINISHED", region);
              await RaceSyncService._upsertResults(card);
              if (result === "created") created++;
              else updated++;
            } catch (err: any) {
              errors.push(`Result race ${card.race_id} (${region}): ${err.message}`);
            }
          }
        } catch (err: any) {
          errors.push(`Results region ${region} date ${dateStr}: ${err.message}`);
        }
      }
    }

    await CacheService.invalidateRace();
    return {
      success: errors.length === 0,
      created,
      updated,
      skipped: 0,
      durationMs: Date.now() - start,
      errors,
    };
  }

  static async enqueueEnrichment(raceId: string, externalId: string): Promise<void> {
    try {
      // 1. Enqueue odds sync
      await Queues.odds.add(JOB_NAMES.SYNC_LIVE_ODDS, { raceId, externalId }, { priority: 2 });

      // 2. Query entries to get horses, jockeys, trainers IDs
      const entries = await prisma.raceEntry.findMany({
        where: { raceId },
        include: { horse: true, jockey: true, trainer: true },
      });

      for (const entry of entries) {
        if (entry.horse?.externalId) {
          await Queues.horse.add(
            JOB_NAMES.SYNC_HORSES,
            { horseId: entry.horseId, externalId: entry.horse.externalId },
            { priority: 3 }
          );
        }
        if (entry.jockey?.externalId && entry.jockeyId) {
          await Queues.jockey.add(
            JOB_NAMES.SYNC_JOCKEYS,
            { jockeyId: entry.jockeyId, externalId: entry.jockey.externalId },
            { priority: 3 }
          );
        }
        if (entry.trainer?.externalId && entry.trainerId) {
          await Queues.trainer.add(
            JOB_NAMES.SYNC_TRAINERS,
            { trainerId: entry.trainerId, externalId: entry.trainer.externalId },
            { priority: 3 }
          );
        }
      }
    } catch (e: any) {
      console.error(`[RaceSyncService] Failed to enqueue enrichment for race ${raceId}:`, e.message);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private static async _upsertRacecard(
    card: any,
    status: RaceStatus,
    region: string
  ): Promise<"created" | "updated"> {
    const externalId = card.race_id?.toString();
    if (!externalId) throw new Error("Missing race_id");

    const raceData = {
      externalId,
      name:           card.race_name || "Unknown Race",
      date:           new Date(card.date),
      time:           card.off_time || "",
      location:       card.course || "Unknown Course",
      country:        getCountryName(region),
      region:         region,
      surface:        card.surface || null,
      distance:       card.distance_f ? `${card.distance_f}f` : null,
      distanceF:      card.distance_f?.toString() || null,
      distanceRound:  card.distance_round || null,
      prize:          card.prize?.toString() || null,
      raceClass:      card.class || null,
      raceType:       card.type || null,
      ageBand:        card.age_band || null,
      sexRestriction: card.sex_restriction || null,
      fieldSize:      card.runners ? card.runners.length : null,
      pattern:        card.pattern || null,
      ratingBand:     card.rating_band || null,
      status,
      courseId:       card.course_id?.toString() || null,
      offDt:          card.off_dt || null,
      goingDetailed:  card.going_detailed || null,
      railMovements:  card.rail_movements || null,
      stalls:         card.stalls || null,
      weather:        card.weather || null,
      jumps:          card.jumps || null,
      bigRace:        card.big_race ?? null,
      isAbandoned:    card.is_abandoned ?? null,
      tip:            card.tip || null,
      verdict:        card.verdict || null,
      winningTimeDetail: card.winning_time_detail || null,
      comments:       card.comments || null,
      nonRunners:     card.non_runners || null,
    };

    const existing = await prisma.race.findUnique({
      where: { externalId },
      select: { id: true },
    });

    if (!existing) {
      await prisma.race.create({ data: raceData });
    } else {
      await prisma.race.update({ where: { externalId }, data: raceData });
    }

    // Upsert runners
    const runners: any[] = card.runners ?? [];
    for (const runner of runners) {
      await RaceSyncService._upsertRunner(externalId, runner);
    }

    // Queue enrichment jobs
    const raceId = existing ? existing.id : (await prisma.race.findUnique({ where: { externalId }, select: { id: true } }))?.id;
    if (raceId) {
      await RaceSyncService.enqueueEnrichment(raceId, externalId);
    }

    return existing ? "updated" : "created";
  }

  private static async _upsertRunner(raceExternalId: string, runner: any): Promise<void> {
    const race = await prisma.race.findUnique({
      where: { externalId: raceExternalId },
      select: { id: true },
    });
    if (!race) return;

    // ── 1. Sire ────────────────────────────────────────────────────────────
    let sireModelId: string | null = null;
    if (runner.sire) {
      let sire = await prisma.sire.findUnique({ where: { name: runner.sire } });
      if (!sire) {
        sire = await prisma.sire.create({
          data: {
            name: runner.sire,
            externalId: runner.sire_id?.toString() || `sire-${runner.sire.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          },
        });
      }
      sireModelId = sire.id;
    }

    // ── 2. Dam ─────────────────────────────────────────────────────────────
    let damModelId: string | null = null;
    if (runner.dam) {
      let dam = await prisma.dam.findUnique({ where: { name: runner.dam } });
      if (!dam) {
        dam = await prisma.dam.create({
          data: {
            name: runner.dam,
            externalId: runner.dam_id?.toString() || `dam-${runner.dam.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          },
        });
      }
      damModelId = dam.id;
    }

    // ── 3. DamSire ─────────────────────────────────────────────────────────
    let damSireModelId: string | null = null;
    if (runner.damsire) {
      let damSire = await prisma.damSire.findUnique({ where: { name: runner.damsire } });
      if (!damSire) {
        damSire = await prisma.damSire.create({
          data: {
            name: runner.damsire,
            externalId: runner.damsire_id?.toString() || `damsire-${runner.damsire.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          },
        });
      }
      damSireModelId = damSire.id;
    }

    // ── 4. Horse ───────────────────────────────────────────────────────────
    let horse = await prisma.horse.findFirst({
      where: { name: runner.horse },
      select: {
        id: true,
        externalId: true,
        sireModelId: true,
        damModelId: true,
        damSireModelId: true,
      },
    });

    const horseData = {
      externalId:     runner.horse_id?.toString() || null,
      name:           runner.horse,
      age:            runner.age ? parseInt(runner.age, 10) : null,
      sex:            runner.sex || null,
      sireName:       runner.sire || null,
      damName:        runner.dam || null,
      damSireName:    runner.damsire || null,
      owner:          runner.owner || null,
      trainer:        runner.trainer || null,
      country:        runner.region || null,
      colour:         runner.colour || null,
      breeder:        runner.breeder || null,
      damRegion:      runner.dam_region || null,
      sireRegion:     runner.sire_region || null,
      damSireRegion:  runner.damsire_region || null,
      sireModelId,
      damModelId,
      damSireModelId,
    };

    if (!horse) {
      horse = await prisma.horse.create({
        data: horseData,
        select: {
          id: true,
          externalId: true,
          sireModelId: true,
          damModelId: true,
          damSireModelId: true,
        },
      });
    } else {
      const patch: any = {};
      if (!horse.externalId && runner.horse_id) patch.externalId = runner.horse_id.toString();
      if (!horse.sireModelId && sireModelId) patch.sireModelId = sireModelId;
      if (!horse.damModelId && damModelId) patch.damModelId = damModelId;
      if (!horse.damSireModelId && damSireModelId) patch.damSireModelId = damSireModelId;
      if (Object.keys(patch).length > 0) {
        await prisma.horse.update({ where: { id: horse.id }, data: patch });
      }
    }

    // ── 5. Trainer ─────────────────────────────────────────────────────────
    let trainer = null;
    if (runner.trainer) {
      trainer = await prisma.trainer.findUnique({ where: { name: runner.trainer }, select: { id: true } });
      if (!trainer) {
        trainer = await prisma.trainer.create({
          data: {
            externalId: runner.trainer_id?.toString() || null,
            name:       runner.trainer,
            location:   runner.trainer_location || null,
          },
          select: { id: true },
        });
      }
    }

    // ── 6. Owner ───────────────────────────────────────────────────────────
    let owner = null;
    if (runner.owner) {
      owner = await prisma.owner.findUnique({ where: { name: runner.owner }, select: { id: true } });
      if (!owner) {
        owner = await prisma.owner.create({
          data: {
            externalId: runner.owner_id?.toString() || null,
            name:       runner.owner,
          },
          select: { id: true },
        });
      }
    }

    // ── 7. Jockey ──────────────────────────────────────────────────────────
    let jockey = null;
    if (runner.jockey) {
      jockey = await prisma.jockey.findFirst({ where: { name: runner.jockey }, select: { id: true } });
      if (!jockey) {
        jockey = await prisma.jockey.create({
          data: {
            externalId: runner.jockey_id?.toString() || null,
            name:       runner.jockey,
          },
          select: { id: true },
        });
      }
    }

    // ── 8. Race Entry ──────────────────────────────────────────────────────
    const entryData = {
      raceId:          race.id,
      horseId:         horse.id,
      jockeyId:        jockey?.id || null,
      trainerId:       trainer?.id || null,
      ownerId:         owner?.id || null,
      jockeyName:      runner.jockey || null,
      trainerName:     runner.trainer || null,
      ownerName:       runner.owner || null,
      weight:          parseWeight(runner.lbs ?? runner.weight),
      weightStr:       runner.lbs || runner.weight || null,
      draw:            runner.draw ? parseInt(runner.draw, 10) : null,
      number:          runner.number || null,
      sexCode:         runner.sex_code || null,
      colour:          runner.colour || null,
      age:             runner.age ? parseInt(runner.age, 10) : null,
      comment:         runner.comment || null,
      spotlight:       runner.spotlight || null,
      headgear:        runner.headgear || null,
      headgearRun:     runner.headgear_run || null,
      windSurgery:     runner.wind_surgery || null,
      windSurgeryRun:  runner.wind_surgery_run || null,
      ofr:             runner.ofr || null,
      rpr:             runner.rpr || null,
      ts:              runner.ts || null,
      silkUrl:         runner.silk_url || null,
      lastRun:         runner.last_run || null,
      form:            runner.form || null,
      trainerRtf:      runner.trainer_rtf || null,
      trainerLocation: runner.trainer_location || null,
    };

    await prisma.raceEntry.upsert({
      where:  { raceId_horseId: { raceId: race.id, horseId: horse.id } },
      update: entryData,
      create: entryData,
    });
  }

  private static async _upsertResults(card: any): Promise<void> {
    const externalId = card.race_id?.toString();
    const race = await prisma.race.findUnique({ where: { externalId }, select: { id: true } });
    if (!race) return;

    const prizeVal = card.prize ? parseFloat(card.prize.toString().replace(/[^0-9.]/g, "")) : 0;

    for (const runner of card.runners ?? []) {
      if (runner.position === null || runner.position === undefined) continue;
      const pos = parseInt(runner.position, 10);
      if (isNaN(pos)) continue;

      const horse = await prisma.horse.findFirst({
        where: { name: runner.horse },
        select: { id: true },
      });
      if (!horse) continue;

      let earnings = 0;
      if (prizeVal > 0) {
        if (pos === 1)      earnings = prizeVal * 0.60;
        else if (pos === 2) earnings = prizeVal * 0.20;
        else if (pos === 3) earnings = prizeVal * 0.12;
        else if (pos === 4) earnings = prizeVal * 0.08;
      }

      await prisma.raceResult.upsert({
        where:  { raceId_horseId: { raceId: race.id, horseId: horse.id } },
        update: {
          position: pos,
          time:     card.winning_time || null,
          earnings: earnings || null,
          btn:      runner.btn || null,
          ovrBtn:   runner.ovr_btn || null,
          or:       runner.or || null,
          rpr:      runner.rpr || null,
          tsr:      runner.tsr || null,
        },
        create: {
          raceId:   race.id,
          horseId:  horse.id,
          jockeyId: null,
          position: pos,
          time:     card.winning_time || null,
          earnings: earnings || null,
          btn:      runner.btn || null,
          ovrBtn:   runner.ovr_btn || null,
          or:       runner.or || null,
          rpr:      runner.rpr || null,
          tsr:      runner.tsr || null,
        },
      });

      // Update horse career stats locally
      const allResults = await prisma.raceResult.findMany({ where: { horseId: horse.id } });
      await prisma.horse.update({
        where: { id: horse.id },
        data: {
          wins:         allResults.filter((r) => r.position === 1).length,
          seconds:      allResults.filter((r) => r.position === 2).length,
          thirds:       allResults.filter((r) => r.position === 3).length,
          fourths:      allResults.filter((r) => r.position === 4).length,
          totalRaces:   allResults.length,
          totalEarnings:allResults.reduce((s, r) => s + (r.earnings ?? 0), 0),
          lastRaceDate: new Date(card.date),
        },
      });
    }
  }
}
