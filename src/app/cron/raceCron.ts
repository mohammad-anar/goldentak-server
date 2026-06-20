import { prisma } from "../../helpers/prisma.js";
import cron from "node-cron";
import { SyncService } from "../modules/analysis/sync.service.js";
import { CalculationService } from "../modules/analysis/calculation.service.js";


export const runRaceSync = async () => {
  console.log(`[${new Date().toISOString()}] Starting automatic race synchronization...`);
  try {
    const result = await SyncService.syncUpcomingRaces();
    console.log(`[${new Date().toISOString()}] Automatic race synchronization completed successfully. Synced ${result.count} races.`);
    
    // Warm up the bulk predictions cache
    try {
      await SyncService.syncBulkPredictions();
    } catch (predError: any) {
      console.error(`[${new Date().toISOString()}] Error caching bulk predictions:`, predError.message);
    }
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error running automatic race synchronization:`, error.message);
  }
};

export const runPendingPredictionsUpdate = async () => {
  console.log(`[${new Date().toISOString()}] Checking for races with ready predictions to calculate...`);
  
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    // Find today's races that have predictions available (hasPredictions == true),
    // but do not have calculations completed yet (entries is empty or entries have null scores)
    const racesToCalculate = await prisma.race.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        hasPredictions: true,
        OR: [
          { entries: { none: {} } },
          { entries: { some: { normalizedScore: null } } }
        ]
      }
    });

    console.log(`[${new Date().toISOString()}] Found ${racesToCalculate.length} races requiring prediction calculation.`);

    for (const race of racesToCalculate) {
      try {
        console.log(`[${new Date().toISOString()}] Auto-calculating scores for race: ${race.location} (${race.externalId})`);
        await CalculationService.calculateRaceScores(race.id);
        console.log(`[${new Date().toISOString()}] Auto-calculated successfully for race: ${race.location}`);
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Failed auto-calculation for race ${race.id} (${race.location}):`, error.message);
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
