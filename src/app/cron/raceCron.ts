import { PrismaClient } from "@prisma/client";
import cron from "node-cron";
import { SyncService } from "../modules/analysis/sync.service.js";

const prisma = new PrismaClient();

export const runRaceSync = async () => {
  console.log(`[${new Date().toISOString()}] Starting automatic race synchronization...`);
  
  try {
    const result = await SyncService.syncUpcomingRaces();
    console.log(`[${new Date().toISOString()}] Automatic race synchronization completed successfully. Synced ${result.count} races.`);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error running automatic race synchronization:`, error.message);
  }
};

export const initRaceCron = () => {
  // Run every 6 hours (at 00:00, 06:00, 12:00, 18:00)
  cron.schedule("0 */6 * * *", async () => {
    await runRaceSync();
  });
  
  console.log("[Race Cron] Cron Scheduler Initialized successfully. Scheduled sync for every 6 hours.");
  
  // Also run an immediate check on startup: if DB is empty, seed it with races right away
  const checkAndSyncOnStartup = async () => {
    try {
      const count = await prisma.race.count();
      if (count === 0) {
        console.log(`[${new Date().toISOString()}] No races found in database. Triggering initial synchronization...`);
        await runRaceSync();
      } else {
        console.log(`[${new Date().toISOString()}] Database already has ${count} races. Skipping initial synchronization.`);
      }
    } catch (error: any) {
      console.error("[Race Cron] Failed to check and sync races on startup:", error.message);
    }
  };

  checkAndSyncOnStartup();
};
