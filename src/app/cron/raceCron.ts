import { prisma } from "../../helpers/prisma.js";
import cron from "node-cron";
import { SyncService } from "../modules/analysis/sync.service.js";
import { CalculationService } from "../modules/analysis/calculation.service.js";
import { RaceStatus } from "@prisma/client";


export const runRaceSync = async () => {
  console.log(`[${new Date().toISOString()}] Starting automatic race synchronization...`);
  
  // 1. Sync upcoming races
  try {
    const result = await SyncService.syncUpcomingRaces();
    console.log(`[${new Date().toISOString()}] Automatic race synchronization completed successfully. Synced ${result.count} upcoming races.`);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error running upcoming race synchronization:`, error.message);
  }

  // 2. Sync recent race results
  try {
    const pastResult = await SyncService.syncPastResults();
    console.log(`[${new Date().toISOString()}] Synced ${pastResult.count} recent race results.`);
  } catch (pastError: any) {
    console.error(`[${new Date().toISOString()}] Error syncing recent race results:`, pastError.message);
  }

  // 3. Warm up bulk predictions cache
  try {
    await SyncService.syncBulkPredictions();
  } catch (predError: any) {
    console.error(`[${new Date().toISOString()}] Error caching bulk predictions:`, predError.message);
  }
};

export const runPendingPredictionsUpdate = async () => {
  console.log(`[${new Date().toISOString()}] Checking for races to calculate/populate...`);
  
  try {
    // Find:
    // 1. Races that have predictions (hasPredictions = true) but do not have calculations completed yet
    // 2. Upcoming/Live races that have 0 entries (so we fetch details/runners regardless of predictions)
    const racesToCalculate = await prisma.race.findMany({
      where: {
        OR: [
          {
            hasPredictions: true,
            OR: [
              { entries: { none: {} } },
              { entries: { some: { normalizedScore: null } } }
            ]
          },
          {
            status: { in: [RaceStatus.UPCOMING, RaceStatus.LIVE] },
            entries: { none: {} }
          }
        ]
      }
    });

    console.log(`[${new Date().toISOString()}] Found ${racesToCalculate.length} races requiring calculation/runner sync.`);

    for (const race of racesToCalculate) {
      try {
        console.log(`[${new Date().toISOString()}] Auto-calculating/populating race: ${race.location} (${race.externalId})`);
        await CalculationService.calculateRaceScores(race.id);
        console.log(`[${new Date().toISOString()}] Populated successfully for race: ${race.location}`);
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Failed calculation for race ${race.id} (${race.location}):`, error.message);
      }
    }
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error running pending predictions check:`, error.message);
  }
};

export const initRaceCron = () => {
  // Run every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    console.log(`[${new Date().toISOString()}] Scheduled Race Cron triggered...`);
    await runRaceSync();
    await runPendingPredictionsUpdate();
  });
  
  console.log("[Race Cron] Cron Scheduler Initialized successfully. Scheduled sync & prediction update check for every 30 minutes.");
  
  // Also run an immediate check on startup
  const checkAndSyncOnStartup = async () => {
    try {
      console.log(`[${new Date().toISOString()}] Triggering startup race synchronization...`);
      await runRaceSync();
      
      console.log(`[${new Date().toISOString()}] Triggering startup predictions update check...`);
      await runPendingPredictionsUpdate();
    } catch (error: any) {
      console.error("[Race Cron] Failed to check and sync races on startup:", error.message);
    }
  };

  checkAndSyncOnStartup();
};
