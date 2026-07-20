import express from "express";
import { SystemController } from "./system.controller.js";
import { SyncController } from "../analysis/sync.controller.js";
import auth from "../../middlewares/auth.js";
import { Role } from "../../../types/enum.js";
import {
  getAlgorithmSettings,
  updateAlgorithmSetting,
  getAlgorithmSettingHistory,
  triggerRecalculation,
  getSyncLogs,
  triggerManualSync,
  getQueueStats,
} from "./admin.controller.js";

const router = express.Router();

// ── Legacy sync (kept for backward compatibility) ─────────────────────────────
router.post("/sync", auth(Role.ADMIN), SyncController.syncRaces);

// ── Lockdown ──────────────────────────────────────────────────────────────────
router.get("/lockdown",           SystemController.getLockdownStatus);
router.post("/lockdown/enable",   auth(Role.ADMIN), SystemController.enableLockdown);
router.post("/lockdown/disable",  auth(Role.ADMIN), SystemController.disableLockdown);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/stats",              auth(Role.ADMIN), SystemController.getDashboardStats);
router.get("/analytics",          auth(Role.ADMIN), SystemController.getDashboardAnalytics);
router.get("/activity/chart",     auth(Role.ADMIN), SystemController.getUserActivityChart);
router.get("/activity/recent",    auth(Role.ADMIN), SystemController.getRecentActivity);
router.get("/api-stats",          auth(Role.ADMIN), SystemController.getApiStats);
router.get("/race-results-stats", auth(Role.ADMIN), SystemController.getRaceResultsStats);

// ── Algorithm Settings ────────────────────────────────────────────────────────
router.get("/algorithm-settings",                 auth(Role.ADMIN), getAlgorithmSettings);
router.patch("/algorithm-settings/:key",          auth(Role.ADMIN), updateAlgorithmSetting);
router.get("/algorithm-settings/history",         auth(Role.ADMIN), getAlgorithmSettingHistory);
router.post("/algorithm/recalculate/:raceId",     auth(Role.ADMIN), triggerRecalculation);

// ── Sync Operations ───────────────────────────────────────────────────────────
router.get("/sync-logs",    auth(Role.ADMIN), getSyncLogs);
router.post("/sync/trigger",auth(Role.ADMIN), triggerManualSync);

// ── Queue Dashboard ───────────────────────────────────────────────────────────
router.get("/queue/stats",  auth(Role.ADMIN), getQueueStats);

export const SystemRouter = router;
