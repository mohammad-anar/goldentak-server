import { Queue, QueueOptions } from "bullmq";
import { bullRedisConnection } from "../helpers/redis.js";

// ─── Queue Names ──────────────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  HORSE:        "horse-queue",
  TRAINER:      "trainer-queue",
  JOCKEY:       "jockey-queue",
  OWNER:        "owner-queue",
  MEETING:      "meeting-queue",
  RACE:         "race-queue",
  RESULT:       "result-queue",
  ODDS:         "odds-queue",
  PREDICTION:   "prediction-queue",
  STATISTICS:   "statistics-queue",
  NOTIFICATION: "notification-queue",
  RETRY:        "retry-queue",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── Default Queue Options ────────────────────────────────────────────────────
const defaultQueueOptions: QueueOptions = {
  connection: bullRedisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail:    { count: 50 },
  },
};

// ─── Queue Instances ──────────────────────────────────────────────────────────
export const Queues = {
  horse:        new Queue(QUEUE_NAMES.HORSE,        defaultQueueOptions),
  trainer:      new Queue(QUEUE_NAMES.TRAINER,      defaultQueueOptions),
  jockey:       new Queue(QUEUE_NAMES.JOCKEY,       defaultQueueOptions),
  owner:        new Queue(QUEUE_NAMES.OWNER,        defaultQueueOptions),
  meeting:      new Queue(QUEUE_NAMES.MEETING,      defaultQueueOptions),
  race:         new Queue(QUEUE_NAMES.RACE,         { ...defaultQueueOptions, defaultJobOptions: { ...defaultQueueOptions.defaultJobOptions, attempts: 5 } }),
  result:       new Queue(QUEUE_NAMES.RESULT,       { ...defaultQueueOptions, defaultJobOptions: { ...defaultQueueOptions.defaultJobOptions, attempts: 5 } }),
  odds:         new Queue(QUEUE_NAMES.ODDS,         { ...defaultQueueOptions, defaultJobOptions: { ...defaultQueueOptions.defaultJobOptions, attempts: 2 } }),
  prediction:   new Queue(QUEUE_NAMES.PREDICTION,   defaultQueueOptions),
  statistics:   new Queue(QUEUE_NAMES.STATISTICS,   defaultQueueOptions),
  notification: new Queue(QUEUE_NAMES.NOTIFICATION, defaultQueueOptions),
  retry:        new Queue(QUEUE_NAMES.RETRY,        { ...defaultQueueOptions, defaultJobOptions: { ...defaultQueueOptions.defaultJobOptions, attempts: 1 } }),
};

// ─── Job Name Constants ───────────────────────────────────────────────────────
export const JOB_NAMES = {
  SYNC_UPCOMING_RACES:    "sync-upcoming-races",
  SYNC_PAST_RESULTS:      "sync-past-results",
  SYNC_LIVE_ODDS:         "sync-live-odds",
  SYNC_HORSES:            "sync-horses",
  SYNC_TRAINERS:          "sync-trainers",
  SYNC_JOCKEYS:           "sync-jockeys",
  SYNC_OWNERS:            "sync-owners",
  SYNC_MEETINGS:          "sync-meetings",
  SYNC_STATISTICS:        "sync-statistics",
  CALCULATE_PREDICTIONS:  "calculate-predictions",
  CALCULATE_RACE:         "calculate-race",
  SEND_NOTIFICATION:      "send-notification",
  SEND_BROADCAST:         "send-broadcast",
} as const;
