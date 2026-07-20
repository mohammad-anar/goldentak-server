import cron from "node-cron";
import { Queues, JOB_NAMES } from "../../queues/queue.registry.js";

// ─────────────────────────────────────────────────────────────────────────────
// Race Cron Bootstrap
//
// Schedules BullMQ jobs at the correct intervals.
// NEVER calls sync services or calculation services directly.
// All work is done by BullMQ workers in the background.
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchUpcomingSync(): Promise<void> {
  try {
    await Queues.race.add(JOB_NAMES.SYNC_UPCOMING_RACES, { days: 3 }, { priority: 2 });
    console.log(`[RaceCron] Enqueued ${JOB_NAMES.SYNC_UPCOMING_RACES}`);
  } catch (err: any) {
    console.error("[RaceCron] Failed to enqueue upcoming sync:", err.message);
  }
}

async function dispatchResultSync(): Promise<void> {
  try {
    await Queues.result.add(JOB_NAMES.SYNC_PAST_RESULTS, { days: 3 }, { priority: 2 });
    console.log(`[RaceCron] Enqueued ${JOB_NAMES.SYNC_PAST_RESULTS}`);
  } catch (err: any) {
    console.error("[RaceCron] Failed to enqueue result sync:", err.message);
  }
}

async function dispatchPredictionBatch(): Promise<void> {
  try {
    await Queues.prediction.add(JOB_NAMES.CALCULATE_PREDICTIONS, {}, { priority: 1 });
    console.log(`[RaceCron] Enqueued ${JOB_NAMES.CALCULATE_PREDICTIONS}`);
  } catch (err: any) {
    console.error("[RaceCron] Failed to enqueue prediction batch:", err.message);
  }
}

export function initRaceCron(): void {
  // ── Every 10 minutes: sync today's racecards (high priority) ─────────────
  cron.schedule("*/10 * * * *", async () => {
    console.log(`[RaceCron] [${new Date().toISOString()}] 10-min tick — syncing today's racecards`);
    await Queues.race.add(JOB_NAMES.SYNC_UPCOMING_RACES, { days: 1 }, { priority: 1 });
  });

  // ── Every 2 minutes: sync race results ───────────────────────────────────
  cron.schedule("*/2 * * * *", async () => {
    console.log(`[RaceCron] [${new Date().toISOString()}] 2-min tick — syncing results`);
    await dispatchResultSync();
    await dispatchPredictionBatch();
  });

  // ── Every hour: sync upcoming races (next 3 days) ─────────────────────────
  cron.schedule("0 * * * *", async () => {
    console.log(`[RaceCron] [${new Date().toISOString()}] Hourly tick — syncing upcoming races`);
    await dispatchUpcomingSync();
  });

  // ── Daily at 00:05 UTC: full sync ─────────────────────────────────────────
  cron.schedule("5 0 * * *", async () => {
    console.log(`[RaceCron] [${new Date().toISOString()}] Daily tick — full sync`);
    await Queues.race.add(JOB_NAMES.SYNC_UPCOMING_RACES, { days: 7 }, { priority: 3 });
    await Queues.result.add(JOB_NAMES.SYNC_PAST_RESULTS, { days: 7 }, { priority: 3 });
  });

  console.log("[RaceCron] Cron scheduler initialised (10min/2min/hourly/daily schedules).");

  // ── Startup: kick off an immediate sync ──────────────────────────────────
  setTimeout(async () => {
    console.log("[RaceCron] Startup — dispatching initial sync jobs...");
    await dispatchUpcomingSync();
    await dispatchResultSync();
    await dispatchPredictionBatch();
  }, 5_000); // 5-second delay to let the server finish starting
}
