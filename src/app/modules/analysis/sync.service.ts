import { RaceStatus } from "@prisma/client";
import { prisma } from "../../../helpers/prisma.js";
import { rapidApi } from "../../config/rapid_api.js";

// ─────────────────────────────────────────────────────────────────────────────
// BULK PREDICTIONS CACHE
// We fetch /predictions/today ONCE per sync cycle and store the result
// in memory. calculateRaceScores() looks here first — avoiding one API
// call per race (saves quota significantly at scale).
// ─────────────────────────────────────────────────────────────────────────────
export interface PredictionCache {
  fetchedAt: Date;
  /** Map<externalRaceId (string), prediction[]> */
  byRaceId: Map<string, any[]>;
}

let _predictionCache: PredictionCache | null = null;

/** Returns the in-memory cache or null if not yet populated. */
export function getPredictionCache(): PredictionCache | null {
  return _predictionCache;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC UPCOMING RACES
// Calls /races/today to upsert today's race cards into the DB.
// ─────────────────────────────────────────────────────────────────────────────
const syncUpcomingRaces = async () => {
  try {
    console.log("[Sync] Fetching today's races from Rapid API...");
    const response = await rapidApi.get("/races/today");
    const races = response.data?.data || [];

    if (races.length > 0) {
      console.log("[Sync] First card sample:", JSON.stringify(races[0]).substring(0, 500));
    }

    for (const card of races) {
      const externalId = card.id.toString();

      let dbStatus: RaceStatus = RaceStatus.UPCOMING;
      if (card.status === "finished") {
        dbStatus = RaceStatus.FINISHED;
      } else if (card.status === "live" || card.status === "off") {
        dbStatus = RaceStatus.LIVE;
      }

      const raceData = {
        externalId,
        name: card.race_name || "Unknown Race",
        date: new Date(card.race_date),
        time: card.off_time || "",
        location: card.racecourse_name || "Unknown Course",
        trackType: card.going || null,
        distance: card.distance || null,
        country: card.country || "United Kingdom",
        status: dbStatus,
        hasPredictions: card.has_predictions || false,
        prize: card.prize_money ? card.prize_money.toString() : null,
      };

      await prisma.race.upsert({
        where: { externalId },
        update: {
          name: raceData.name,
          date: raceData.date,
          time: raceData.time,
          location: raceData.location,
          trackType: raceData.trackType,
          distance: raceData.distance,
          country: raceData.country,
          status: raceData.status,
          hasPredictions: raceData.hasPredictions,
          prize: raceData.prize,
        },
        create: raceData,
      });
    }

    return { success: true, count: races.length };
  } catch (error: any) {
    console.error("Sync Error:", error.message);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SYNC BULK PREDICTIONS
// Calls GET /predictions/today — one request that returns every horse's AI
// prediction for all races today. Result is indexed into _predictionCache
// so calculateRaceScores() can look up predictions instantly without an
// extra API round-trip per race.
//
// The API description says predictions are pre-generated at 07:30 UTC,
// so this should be called in the cron after 07:30 UTC.
//
// Expected response shape (based on the API's /predictions/race/{id} format):
//   {
//     data: [
//       {
//         race_id: 123,
//         predictions: [
//           { horse_id, horse_name, win: {...}, place: {...},
//             going_suitability: {...}, distance_suitability: {...},
//             course_specialist: {...}, draw_bias: {...},
//             jockey_form: {...}, trainer_form: {...},
//             each_way: {...}, value_edge: {...},
//             selection_rank, confidence, confidence_score, analysis }
//         ]
//       }
//     ]
//   }
// ─────────────────────────────────────────────────────────────────────────────
const syncBulkPredictions = async (): Promise<PredictionCache> => {
  console.log("[Sync] Fetching today's bulk predictions from Rapid API (GET /predictions/today)...");

  const response = await rapidApi.get("/predictions/today");
  const rawData: any[] = response.data?.races || response.data?.data || response.data?.predictions || [];

  const byRaceId = new Map<string, any[]>();

  for (const raceBlock of rawData) {
    // Handle both flat array and nested { race_id, predictions[] } shapes
    const raceId = raceBlock.race_id?.toString() ?? raceBlock.id?.toString();
    const preds: any[] = raceBlock.predictions ?? (Array.isArray(raceBlock) ? raceBlock : []);

    if (raceId && preds.length > 0) {
      byRaceId.set(raceId, preds);
    }
  }

  _predictionCache = {
    fetchedAt: new Date(),
    byRaceId,
  };

  const totalPreds = Array.from(byRaceId.values()).reduce((s, p) => s + p.length, 0);
  console.log(
    `[Sync] Bulk predictions cached: ${byRaceId.size} races, ${totalPreds} total horse predictions.`
  );

  return _predictionCache;
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK LIVE RACES
// Refresh status for today's UPCOMING races so the home screen live filter
// reflects real-time state changes (race going "off" → LIVE → FINISHED).
// Calls /races/today again (same as sync, but lightweight status-only update).
// ─────────────────────────────────────────────────────────────────────────────
const refreshRaceStatuses = async () => {
  try {
    console.log("[Sync] Refreshing race statuses...");
    const response = await rapidApi.get("/races/today");
    const races = response.data?.data || [];
    let updated = 0;

    for (const card of races) {
      const externalId = card.id.toString();
      let dbStatus: RaceStatus = RaceStatus.UPCOMING;
      if (card.status === "finished") dbStatus = RaceStatus.FINISHED;
      else if (card.status === "live" || card.status === "off") dbStatus = RaceStatus.LIVE;

      const existing = await prisma.race.findUnique({ where: { externalId }, select: { status: true } });
      if (existing && existing.status !== dbStatus) {
        await prisma.race.update({ where: { externalId }, data: { status: dbStatus } });
        updated++;
      }
    }

    console.log(`[Sync] Status refresh done. ${updated} race(s) updated.`);
    return { updated };
  } catch (error: any) {
    console.error("[Sync] Status refresh error:", error.message);
    return { updated: 0 };
  }
};

export const SyncService = {
  syncUpcomingRaces,
  syncBulkPredictions,
  refreshRaceStatuses,
};
