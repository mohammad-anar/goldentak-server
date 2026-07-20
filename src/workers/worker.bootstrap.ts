import { Worker, Job } from "bullmq";
import { bullRedisConnection } from "../helpers/redis.js";
import { QUEUE_NAMES, JOB_NAMES } from "../queues/queue.registry.js";
import { RaceSyncService } from "../sync/race.sync.service.js";
import { PredictionRankingService } from "../algorithm/prediction-ranking.service.js";
import { EnrichmentService } from "../app/modules/analysis/enrichment.service.js";
import { prisma } from "../helpers/prisma.js";
import { SyncStatus } from "@prisma/client";

const CONCURRENCY = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Race Sync Worker
// ─────────────────────────────────────────────────────────────────────────────
export function createRaceWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.RACE,
    async (job: Job) => {
      const syncLog = await prisma.syncLog.create({
        data: { service: "RaceSyncService", status: "RUNNING", jobId: job.id },
      });

      try {
        let result: any;

        if (job.name === JOB_NAMES.SYNC_UPCOMING_RACES) {
          const { days = 3 } = job.data;
          result = await RaceSyncService.syncUpcoming(days);
          console.log(
            `[RaceWorker] syncUpcoming(${days}) done — created: ${result.created}, updated: ${result.updated}, errors: ${result.errors.length}`
          );
        } else if (job.name === JOB_NAMES.SYNC_PAST_RESULTS) {
          const { days = 3 } = job.data;
          result = await RaceSyncService.syncResults(days);
          console.log(
            `[RaceWorker] syncResults(${days}) done — created: ${result.created}, updated: ${result.updated}, errors: ${result.errors.length}`
          );
        } else {
          console.warn(`[RaceWorker] Unknown job name: ${job.name}`);
          result = { success: true };
        }

        const status: SyncStatus = result?.success ? "SUCCESS" : "PARTIAL";

        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status,
            completedAt:      new Date(),
            durationMs:       result?.durationMs,
            recordsProcessed: (result?.created ?? 0) + (result?.updated ?? 0),
            error:            result?.errors?.join("; ") || null,
          },
        });

        return result;
      } catch (err: any) {
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: { status: "FAILED", completedAt: new Date(), error: err.message },
        });
        throw err;
      }
    },
    {
      connection: bullRedisConnection,
      concurrency: CONCURRENCY,
    }
  );

  worker.on("completed", (job) => console.log(`[RaceWorker] Job ${job.id} (${job.name}) completed.`));
  worker.on("failed", (job, err) => console.error(`[RaceWorker] Job ${job?.id} failed: ${err.message}`));

  return worker;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment Workers (Horse, Jockey, Trainer, Odds)
// ─────────────────────────────────────────────────────────────────────────────
export function createHorseWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.HORSE,
    async (job: Job) => {
      if (job.name === JOB_NAMES.SYNC_HORSES) {
        const { horseId, externalId } = job.data;
        if (!horseId || !externalId) throw new Error("Missing horseId or externalId in horse job");
        const success = await EnrichmentService.enrichHorse(horseId, externalId);
        return { horseId, success };
      }
    },
    { connection: bullRedisConnection, concurrency: CONCURRENCY }
  );
}

export function createJockeyWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.JOCKEY,
    async (job: Job) => {
      if (job.name === JOB_NAMES.SYNC_JOCKEYS) {
        const { jockeyId, externalId } = job.data;
        if (!jockeyId || !externalId) throw new Error("Missing jockeyId or externalId in jockey job");
        const success = await EnrichmentService.enrichJockey(jockeyId, externalId);
        return { jockeyId, success };
      }
    },
    { connection: bullRedisConnection, concurrency: CONCURRENCY }
  );
}

export function createTrainerWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.TRAINER,
    async (job: Job) => {
      if (job.name === JOB_NAMES.SYNC_TRAINERS) {
        const { trainerId, externalId } = job.data;
        if (!trainerId || !externalId) throw new Error("Missing trainerId or externalId in trainer job");
        const success = await EnrichmentService.enrichTrainer(trainerId, externalId);
        return { trainerId, success };
      }
    },
    { connection: bullRedisConnection, concurrency: CONCURRENCY }
  );
}

export function createOddsWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.ODDS,
    async (job: Job) => {
      if (job.name === JOB_NAMES.SYNC_LIVE_ODDS) {
        const { raceId, externalId } = job.data;
        if (!raceId || !externalId) throw new Error("Missing raceId or externalId in odds job");
        const success = await EnrichmentService.syncOdds(raceId, externalId);
        return { raceId, success };
      }
    },
    { connection: bullRedisConnection, concurrency: CONCURRENCY }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prediction Worker
// ─────────────────────────────────────────────────────────────────────────────
export function createPredictionWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.PREDICTION,
    async (job: Job) => {
      if (job.name === JOB_NAMES.CALCULATE_RACE) {
        const { raceId } = job.data;
        if (!raceId) throw new Error("raceId missing in prediction job data");
        console.log(`[PredictionWorker] Calculating race: ${raceId}`);
        const ranked = await PredictionRankingService.calculateForRace(raceId, "worker");
        return { raceId, ranked: ranked.length };
      }

      if (job.name === JOB_NAMES.CALCULATE_PREDICTIONS) {
        const pending = await prisma.race.findMany({
          where: {
            OR: [
              { hasPredictions: false },
              { entries: { some: { rawScore: null } } },
            ],
          },
          select: { id: true },
          take: 20,
        });

        console.log(`[PredictionWorker] Found ${pending.length} races to calculate.`);
        for (const race of pending) {
          try {
            await PredictionRankingService.calculateForRace(race.id, "worker");
          } catch (err: any) {
            console.error(`[PredictionWorker] Failed for race ${race.id}: ${err.message}`);
          }
        }
        return { calculated: pending.length };
      }

      console.warn(`[PredictionWorker] Unknown job name: ${job.name}`);
    },
    {
      connection: bullRedisConnection,
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => console.log(`[PredictionWorker] Job ${job.id} (${job.name}) completed.`));
  worker.on("failed", (job, err) => console.error(`[PredictionWorker] Job ${job?.id} failed: ${err.message}`));

  return worker;
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Bootstrap
// ─────────────────────────────────────────────────────────────────────────────
let _workers: Worker[] = [];

export function startWorkers(): void {
  if (process.env.DISABLE_WORKERS === "true") {
    console.log("[Workers] Workers disabled via DISABLE_WORKERS env.");
    return;
  }

  _workers = [
    createRaceWorker(),
    createHorseWorker(),
    createJockeyWorker(),
    createTrainerWorker(),
    createOddsWorker(),
    createPredictionWorker(),
  ];

  console.log(`[Workers] ${_workers.length} BullMQ workers started.`);
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(_workers.map((w) => w.close()));
  console.log("[Workers] All workers stopped.");
}
