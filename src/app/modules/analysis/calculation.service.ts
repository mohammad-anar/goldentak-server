import { prisma } from "../../../helpers/prisma.js";
import { rapidApi } from "../../config/rapid_api.js";
import { getPredictionCache } from "./sync.service.js";
import { NotificationService } from "../notification/notification.service.js";
import { NotificationType } from "@prisma/client";
import { pushRaceUpdate } from "../../../helpers/sseHelper.js";
import { clearRaceCache } from "../../../helpers/redis.js";

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHT PARSER
// Supports numeric strings, stone-lbs format "10-3", or plain floats.
// ─────────────────────────────────────────────────────────────────────────────
function parseWeight(weightStr: string | null | undefined): number {
  if (!weightStr) return 0;

  const numeric = Number(weightStr);
  if (!isNaN(numeric)) return numeric;

  const parts = weightStr.split("-");
  if (parts.length === 2) {
    const stones = parseInt(parts[0], 10);
    const lbs = parseInt(parts[1], 10);
    if (!isNaN(stones) && !isNaN(lbs)) {
      return stones * 14 + lbs;
    }
  }

  const parsed = parseFloat(weightStr);
  return isNaN(parsed) ? 0 : parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// POWER FORMULA
// Power = (1st×4 + 2nd×3 + 3rd×2 + 4th×1) / Toplam
// Returns 0 if Toplam is 0 (no races), capped to 4.0 max.
// ─────────────────────────────────────────────────────────────────────────────
function computePower(
  toplam: number,
  first: number,
  second: number,
  third: number,
  fourth: number
): number {
  if (toplam <= 0) return 0;
  const raw = (first * 4 + second * 3 + third * 2 + fourth * 1) / toplam;
  return Math.min(parseFloat(raw.toFixed(4)), 4.0);
}

// ─────────────────────────────────────────────────────────────────────────────
// PEDIGREE POWER
// Blend: 40% Father + 30% Mother + 30% Mother's Father
// Each component is computed from the sire/dam/damSire win-rate cached in Horse.
// Win-rate fields (sireWinRate, damWinRate, damSireWinRate) represent
// (wins / totalRaces) for that ancestor — stored during prior calculation runs.
// We map them to the same [0, 4] Power scale for consistency.
// ─────────────────────────────────────────────────────────────────────────────
function computePedigreePower(
  sireWinRate: number | null,
  damWinRate: number | null,
  damSireWinRate: number | null
): number {
  // Fallback to 0 when ancestor data is unavailable
  const fatherPower = (sireWinRate ?? 0) * 4;
  const motherPower = (damWinRate ?? 0) * 4;
  const mothersFatherPower = (damSireWinRate ?? 0) * 4;
  return parseFloat(
    (fatherPower * 0.4 + motherPower * 0.3 + mothersFatherPower * 0.3).toFixed(4)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EARNING SCORE  (normalised to 0-100 range, relative within the race field)
// earningScore = avgEarningPerRace / maxAvgEarning * 100
// ─────────────────────────────────────────────────────────────────────────────
function computeEarningScore(
  totalEarnings: number,
  totalRaces: number,
  maxAvgEarning: number
): number {
  if (totalRaces <= 0 || maxAvgEarning <= 0) return 0;
  const avg = totalEarnings / totalRaces;
  return Math.min(parseFloat(((avg / maxAvgEarning) * 100).toFixed(2)), 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHT SCORE  (higher weight ≈ higher class;  normalised within field 0–100)
// ─────────────────────────────────────────────────────────────────────────────
function computeWeightScore(weight: number, maxWeight: number): number {
  if (maxWeight <= 0) return 0;
  return Math.min(parseFloat(((weight / maxWeight) * 100).toFixed(2)), 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL NORMALIZED SCORE
// Weighted blend of all five components.
//   Horse Power   : 30 %
//   Jockey Power  : 20 %
//   Pedigree Power: 20 %
//   Earning Score : 20 %
//   Weight Score  : 10 %
// Result is rescaled to 0–100.
// ─────────────────────────────────────────────────────────────────────────────
function computeFinalScore(
  horsePower: number,      // 0–4
  jockeyPower: number,     // 0–4
  pedigreePower: number,   // 0–4
  earningScore: number,    // 0–100
  weightScore: number      // 0–100
): number {
  // Normalise powers to 0–100 first
  const hpN = (horsePower / 4) * 100;
  const jpN = (jockeyPower / 4) * 100;
  const ppN = (pedigreePower / 4) * 100;

  const raw =
    hpN * 0.30 +
    jpN * 0.20 +
    ppN * 0.20 +
    earningScore * 0.20 +
    weightScore * 0.10;

  return Math.min(Math.round(raw), 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVICE
// ─────────────────────────────────────────────────────────────────────────────
const calculateRaceScores = async (raceId: string) => {
  console.log(`[Calc] Starting analysis for race: ${raceId}`);

  // 1. Fetch Race from DB
  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) throw new Error("Race not found");

  // 2. Fetch race details from Rapid API
  console.log(`[Calc] Fetching race details from Rapid API for external ID: ${race.externalId}`);
  const detailsResponse = await rapidApi.get(`/races/${race.externalId}`);
  const apiRace = detailsResponse.data?.data;

  if (!apiRace) {
    throw new Error(`Failed to fetch race details from Rapid API for ID ${race.externalId}`);
  }

  // 3. Update race meta fields
  const dbStatus =
    apiRace.status === "finished"
      ? "FINISHED"
      : apiRace.status === "live" || apiRace.status === "off"
      ? "LIVE"
      : "UPCOMING";

  await prisma.race.update({
    where: { id: race.id },
    data: {
      prize: apiRace.prize_money ? apiRace.prize_money.toString() : race.prize,
      trackType: apiRace.going || race.trackType,
      distance: apiRace.distance || race.distance,
      status: dbStatus as any,
    },
  });

  // Trigger status change notifications if appropriate
  await NotificationService.handleRaceStatusChange(race.id, race.status, dbStatus as any);

  const apiEntries = apiRace.entries || [];
  console.log(`[Calc] Synced details. Found ${apiEntries.length} entries.`);

  // 4. Upsert Horses, Jockeys, and Race Entries
  for (const entry of apiEntries) {
    // ── 4a. Horse ──────────────────────────────────────────────────────────
    let horse = await prisma.horse.findUnique({ where: { name: entry.horse_name } });

    if (!horse) {
      horse = await prisma.horse.create({
        data: {
          externalId: entry.horse_id?.toString() || null,
          name: entry.horse_name,
          age: entry.horse_age || null,
          sex: entry.horse_sex || null,
          sireName: entry.sire || null,
          damName: entry.dam || null,
          damSireName: entry.dam_sire || null,
          country: entry.horse_country || null,
          // Stats start at zero — will be updated from real results below
          totalRaces: 0,
          wins: 0,
          seconds: 0,
          thirds: 0,
          fourths: 0,
          totalEarnings: 0,
        },
      });
    } else {
      const updateData: any = {};
      if (entry.horse_id && !horse.externalId) updateData.externalId = entry.horse_id.toString();
      if (entry.horse_country && !horse.country) updateData.country = entry.horse_country;
      if (entry.sire && !horse.sireName) updateData.sireName = entry.sire;
      if (entry.dam && !horse.damName) updateData.damName = entry.dam;
      if (entry.dam_sire && !horse.damSireName) updateData.damSireName = entry.dam_sire;

      if (Object.keys(updateData).length > 0) {
        horse = await prisma.horse.update({ where: { id: horse.id }, data: updateData });
      }
    }

    // ── 4b. Jockey ────────────────────────────────────────────────────────
    let jockey = null;
    if (entry.jockey_name) {
      jockey = await prisma.jockey.findFirst({ where: { name: entry.jockey_name } });

      if (!jockey) {
        jockey = await prisma.jockey.create({
          data: {
            externalId: entry.jockey_id?.toString() || null,
            name: entry.jockey_name,
          },
        });
      } else if (entry.jockey_id && !jockey.externalId) {
        jockey = await prisma.jockey.update({
          where: { id: jockey.id },
          data: { externalId: entry.jockey_id.toString() },
        });
      }
    }

    // ── 4c. RaceEntry ─────────────────────────────────────────────────────
    const parsedWeight = parseWeight(entry.weight);
    await prisma.raceEntry.upsert({
      where: { raceId_horseId: { raceId: race.id, horseId: horse.id } },
      update: {
        jockeyId: jockey?.id || null,
        jockeyName: entry.jockey_name || null,
        trainerName: entry.trainer_name || null,
        weight: parsedWeight,
        draw: entry.draw || null,
      },
      create: {
        raceId: race.id,
        horseId: horse.id,
        jockeyId: jockey?.id || null,
        jockeyName: entry.jockey_name || null,
        trainerName: entry.trainer_name || null,
        weight: parsedWeight,
        draw: entry.draw || null,
      },
    });

    // ── 4d. RaceResult + career stats update (if finish position known) ───
    if (entry.finish_position !== null && entry.finish_position !== undefined) {
      const pos = parseInt(entry.finish_position, 10);
      if (!isNaN(pos)) {
        const prizeMoney = apiRace.prize_money ? parseFloat(apiRace.prize_money) : 0;
        let earnings = 0;
        if (prizeMoney > 0) {
          if (pos === 1) earnings = prizeMoney * 0.60;
          else if (pos === 2) earnings = prizeMoney * 0.20;
          else if (pos === 3) earnings = prizeMoney * 0.12;
          else if (pos === 4) earnings = prizeMoney * 0.08;
        }

        await prisma.raceResult.upsert({
          where: { raceId_horseId: { raceId: race.id, horseId: horse.id } },
          update: {
            position: pos,
            time: apiRace.winning_time || null,
            earnings: earnings > 0 ? earnings : null,
          },
          create: {
            raceId: race.id,
            horseId: horse.id,
            jockeyId: jockey?.id || null,
            position: pos,
            time: apiRace.winning_time || null,
            earnings: earnings > 0 ? earnings : null,
          },
        });

        // Update Horse career stats from REAL DB results only
        const horseResults = await prisma.raceResult.findMany({ where: { horseId: horse.id } });
        const dbWins     = horseResults.filter(r => r.position === 1).length;
        const dbSeconds  = horseResults.filter(r => r.position === 2).length;
        const dbThirds   = horseResults.filter(r => r.position === 3).length;
        const dbFourths  = horseResults.filter(r => r.position === 4).length;
        const dbEarnings = horseResults.reduce((sum, r) => sum + (r.earnings || 0), 0);

        await prisma.horse.update({
          where: { id: horse.id },
          data: {
            wins: dbWins,
            seconds: dbSeconds,
            thirds: dbThirds,
            fourths: dbFourths,
            totalRaces: horseResults.length,
            totalEarnings: dbEarnings,
            // Cache win rate for pedigree power computations on offspring
            sireWinRate: horseResults.length > 0 ? dbWins / horseResults.length : 0,
          },
        });

        // Update Jockey career stats
        if (jockey) {
          const jockeyResults = await prisma.raceResult.findMany({ where: { jockeyId: jockey.id } });
          const jWins    = jockeyResults.filter(r => r.position === 1).length;
          const jSeconds = jockeyResults.filter(r => r.position === 2).length;
          const jThirds  = jockeyResults.filter(r => r.position === 3).length;
          const jFourths = jockeyResults.filter(r => r.position === 4).length;

          await prisma.jockey.update({
            where: { id: jockey.id },
            data: {
              wins: jWins,
              seconds: jSeconds,
              thirds: jThirds,
              fourths: jFourths,
              totalRides: jockeyResults.length,
            },
          });
        }
      }
    }
  }

  // 5. Resolve AI predictions — bulk cache first, per-race fallback
  let apiPredictions: any[] = [];

  const cache = getPredictionCache();
  if (cache && cache.byRaceId.has(race.externalId)) {
    // ✅ Use the bulk-fetched cache (no extra API call!)
    apiPredictions = cache.byRaceId.get(race.externalId) ?? [];
    console.log(
      `[Calc] Predictions loaded from bulk cache for race ${race.externalId}. Count: ${apiPredictions.length}`
    );
    await prisma.race.update({
      where: { id: race.id },
      data: { predictionMessage: null, hasPredictions: apiPredictions.length > 0 },
    });
  } else {
    // ⚠️ Fallback: fetch individually (cache not yet populated or race not in cache)
    console.log(
      `[Calc] No bulk cache for race ${race.externalId} — fetching from /predictions/race/${race.externalId}`
    );
    const predictionsResponse = await rapidApi.get(`/predictions/race/${race.externalId}`);
    const predData = predictionsResponse.data;

    if (predData.status === "pending") {
      const pendingMsg = predData.message || "Predictions for this race are currently pending.";
      console.log(`[Calc] Predictions pending: ${pendingMsg}`);
      await prisma.race.update({
        where: { id: race.id },
        data: { predictionMessage: pendingMsg, hasPredictions: false },
      });
      throw new Error(pendingMsg);
    }

    apiPredictions = predData.predictions || [];
    await prisma.race.update({
      where: { id: race.id },
      data: { predictionMessage: null, hasPredictions: true },
    });
    console.log(`[Calc] Individual predictions fetched. Count: ${apiPredictions.length}`);
  }

  // 6. Load all DB entries for scoring
  const dbEntries = await prisma.raceEntry.findMany({
    where: { raceId: race.id },
    include: { horse: true, jockey: true },
  });

  // Pre-compute field-wide maxima for normalisation
  const maxAvgEarning = dbEntries.reduce((max, e) => {
    const avg =
      e.horse.totalRaces > 0 ? (e.horse.totalEarnings || 0) / e.horse.totalRaces : 0;
    return avg > max ? avg : max;
  }, 1); // avoid division by zero

  const maxWeight = dbEntries.reduce((max, e) => {
    const w = e.weight || 0;
    return w > max ? w : max;
  }, 1);

  const results = [];

  for (const entry of dbEntries) {
    const { horse, jockey } = entry;

    // ── 6a. Horse Power ───────────────────────────────────────────────────
    const horsePower = computePower(
      horse.totalRaces,
      horse.wins,
      horse.seconds,
      horse.thirds,
      horse.fourths
    );

    // ── 6b. Jockey Power ──────────────────────────────────────────────────
    const jockeyPower = jockey
      ? computePower(
          jockey.totalRides,
          jockey.wins,
          jockey.seconds,
          jockey.thirds,
          jockey.fourths
        )
      : 0;

    // ── 6c. Pedigree Power ────────────────────────────────────────────────
    // Use cached ancestor win rates on the Horse record.
    // For sire power: look up the sire horse by name to get its win rate.
    let sireWinRate = horse.sireWinRate;
    let damWinRate = horse.damWinRate;
    let damSireWinRate = horse.damSireWinRate;

    if (horse.sireName && sireWinRate === null) {
      const sireHorse = await prisma.horse.findFirst({
        where: { name: { equals: horse.sireName, mode: "insensitive" } },
        select: { wins: true, totalRaces: true },
      });
      if (sireHorse && sireHorse.totalRaces > 0) {
        sireWinRate = sireHorse.wins / sireHorse.totalRaces;
      }
    }
    if (horse.damName && damWinRate === null) {
      const damHorse = await prisma.horse.findFirst({
        where: { name: { equals: horse.damName, mode: "insensitive" } },
        select: { wins: true, totalRaces: true },
      });
      if (damHorse && damHorse.totalRaces > 0) {
        damWinRate = damHorse.wins / damHorse.totalRaces;
      }
    }
    if (horse.damSireName && damSireWinRate === null) {
      const damSireHorse = await prisma.horse.findFirst({
        where: { name: { equals: horse.damSireName, mode: "insensitive" } },
        select: { wins: true, totalRaces: true },
      });
      if (damSireHorse && damSireHorse.totalRaces > 0) {
        damSireWinRate = damSireHorse.wins / damSireHorse.totalRaces;
      }
    }

    const pedigreePower = computePedigreePower(sireWinRate, damWinRate, damSireWinRate);

    // ── 6d. Earning & Weight Scores ───────────────────────────────────────
    const earningScore = computeEarningScore(
      horse.totalEarnings || 0,
      horse.totalRaces,
      maxAvgEarning
    );
    const weightScore = computeWeightScore(entry.weight || 0, maxWeight);

    // ── 6e. Final Score ───────────────────────────────────────────────────
    const finalScore = computeFinalScore(
      horsePower,
      jockeyPower,
      pedigreePower,
      earningScore,
      weightScore
    );

    // ── 6f. AI prediction fields ──────────────────────────────────────────
    const predItem = apiPredictions.find(
      (p: any) =>
        (p.horse_id && horse.externalId && p.horse_id.toString() === horse.externalId) ||
        (p.horse_name && p.horse_name.toLowerCase() === horse.name.toLowerCase())
    );

    let aiFields: any = {
      winProb: null,
      winOddsFair: null,
      placeProb: null,
      eachWayProb: null,
      goingSuitabilityScore: null,
      distanceSuitabilityScore: null,
      courseSpecialistScore: null,
      drawBiasScore: null,
      jockeyFormScore: null,
      trainerFormScore: null,
      aiSelectionRank: null,
      aiConfidence: null,
      aiConfidenceScore: null,
      aiAnalysis: null,
      hasValueEdge: null,
      valueEdgePercent: null,
    };

    if (predItem) {
      aiFields = {
        // ── Core Win / Place ─────────────────────────────────────────────
        winProb:     predItem.win?.win_prob        ?? null,
        winOddsFair: predItem.win?.win_odds_fair   ?? null,
        placeProb:   predItem.place?.place_prob    ?? null,
        eachWayProb: predItem.each_way?.each_way_prob ?? null,

        // ── Suitability Scores ───────────────────────────────────────────
        goingSuitabilityScore:    predItem.going_suitability?.score    ?? null,
        distanceSuitabilityScore: predItem.distance_suitability?.score ?? null,
        courseSpecialistScore:    predItem.course_specialist?.score    ?? null,
        drawBiasScore:            predItem.draw_bias?.score            ?? null,

        // ── Form Scores ──────────────────────────────────────────────────
        jockeyFormScore:  predItem.jockey_form?.score  ?? null,
        trainerFormScore: predItem.trainer_form?.score ?? null,

        // ── AI Meta ──────────────────────────────────────────────────────
        aiSelectionRank:  predItem.selection_rank    ?? null,
        aiConfidence:     predItem.confidence        ?? null,
        aiConfidenceScore: predItem.confidence_score ?? null,
        aiAnalysis:       predItem.analysis          ?? null,

        // ── Value Edge — highlights underpriced horses vs bookmaker ──────
        hasValueEdge:     predItem.value_edge?.has_value     ?? null,
        valueEdgePercent: predItem.value_edge?.edge_percent  ?? null,
      };

      // Update Jockey recent form stats
      if (jockey && predItem.jockey_form) {
        await prisma.jockey.update({
          where: { id: jockey.id },
          data: {
            winsLast30d:  predItem.jockey_form.recent_wins || 0,
            ridesLast30d: predItem.jockey_form.recent_runs || 0,
          },
        });
      }
    }

    // Map AI confidence to category
    let category = null;
    if (aiFields.aiConfidence) {
      const confUpper = aiFields.aiConfidence.toUpperCase();
      if (confUpper === "HIGH") category = "BIG";
      else if (confUpper === "MEDIUM") category = "MEDIUM";
      else if (confUpper === "LOW") category = "SMALL";
    }

    results.push({
      id: entry.id,
      horsePower,
      jockeyPower,
      pedigreePower,
      earningScore,
      weightScore,
      normalizedScore: finalScore,
      category,
      aiSelectionRank: aiFields.aiSelectionRank,
      ...aiFields,
    });
  }

  // 7. Sort: prefer AI selection rank, fall back to our formula score
  results.sort((a, b) => {
    if (a.aiSelectionRank !== null && b.aiSelectionRank !== null) {
      return a.aiSelectionRank - b.aiSelectionRank;
    }
    if (a.aiSelectionRank !== null) return -1;
    if (b.aiSelectionRank !== null) return 1;
    return b.normalizedScore - a.normalizedScore;
  });

  // 8. Persist scores to DB
  for (let i = 0; i < results.length; i++) {
    const p = results[i];
    const rank = p.aiSelectionRank !== null ? p.aiSelectionRank : i + 1;

    await prisma.raceEntry.update({
      where: { id: p.id },
      data: {
        horsePower: p.horsePower,
        jockeyPower: p.jockeyPower,
        normalizedScore: p.normalizedScore,
        category: p.category,
        rank,
        // ── Core Markets ────────────────────────────────────────────────
        winProb:     p.winProb,
        winOddsFair: p.winOddsFair,
        placeProb:   p.placeProb,
        eachWayProb: p.eachWayProb,
        // ── Suitability ─────────────────────────────────────────────────
        goingSuitabilityScore:    p.goingSuitabilityScore,
        distanceSuitabilityScore: p.distanceSuitabilityScore,
        courseSpecialistScore:    p.courseSpecialistScore,
        drawBiasScore:            p.drawBiasScore,
        // ── Form ────────────────────────────────────────────────────────
        jockeyFormScore:  p.jockeyFormScore,
        trainerFormScore: p.trainerFormScore,
        // ── AI Meta ─────────────────────────────────────────────────────
        aiSelectionRank:   p.aiSelectionRank,
        aiConfidence:      p.aiConfidence,
        aiConfidenceScore: p.aiConfidenceScore,
        aiAnalysis:        p.aiAnalysis,
        // ── Value Edge ──────────────────────────────────────────────────
        hasValueEdge:     p.hasValueEdge,
        valueEdgePercent: p.valueEdgePercent,
      },
    });
  }

  // 9. Update Race-level prediction summary
  const topResult = results[0];
  let tahmin1X = "1X";
  let riskRate = 60;
  let predictionMessage = "No prediction available.";

  if (topResult) {
    const confidence = (topResult.aiConfidence || "MEDIUM").toUpperCase();
    if (confidence === "HIGH") {
      tahmin1X = "1";
      riskRate = 85;
    } else if (confidence === "MEDIUM") {
      tahmin1X = "1X";
      riskRate = 65;
    } else {
      tahmin1X = "12";
      riskRate = 45;
    }

    const topEntry = dbEntries.find(e => e.id === topResult.id);
    const topHorseName = topEntry?.horse?.name || "The top horse";
    const winProbPercent = topResult.winProb
      ? Math.round(topResult.winProb * 100)
      : Math.round(topResult.normalizedScore);

    let analysisText = topResult.aiAnalysis || "";
    if (analysisText) {
      analysisText = analysisText.replace(/\b9%/g, `${winProbPercent}%`);
    } else {
      analysisText = `${topHorseName} is the top selected runner with a ${winProbPercent}% win probability based on horse power (${topResult.horsePower.toFixed(2)}), jockey power (${topResult.jockeyPower.toFixed(2)}), and pedigree (${topResult.pedigreePower.toFixed(2)}).`;
    }
    predictionMessage = analysisText;
  }

  await prisma.race.update({
    where: { id: race.id },
    data: { tahmin1X, riskRate, predictionMessage, hasPredictions: true },
  });

  if (results.length > 0) {
    await NotificationService.sendRaceNotification(race.id, NotificationType.PREDICTION_READY);
  }

  // 10. Fetch sorted entries and push SSE update
  const finalEntries = await prisma.raceEntry.findMany({
    where: { raceId: race.id },
    include: { horse: true, jockey: true },
    orderBy: { rank: "asc" },
  });

  const updatedRace = await prisma.race.findUnique({
    where: { id: race.id },
  });

  if (updatedRace) {
    pushRaceUpdate(race.id, {
      ...updatedRace,
      entries: finalEntries,
    });
  }

  await clearRaceCache(race.id);

  return finalEntries;
};

export const CalculationService = {
  calculateRaceScores,
};
