import express from "express";
import { SystemController } from "./system.controller.js";
import { SyncController } from "../analysis/sync.controller.js";
import auth from "../../middlewares/auth.js";
import { Role } from "../../../types/enum.js";

const router = express.Router();

router.post("/sync", auth(Role.ADMIN), SyncController.syncRaces);

router.get("/lockdown", SystemController.getLockdownStatus);
router.post("/lockdown/enable", auth(Role.ADMIN), SystemController.enableLockdown);
router.post("/lockdown/disable", auth(Role.ADMIN), SystemController.disableLockdown);

router.get("/stats", auth(Role.ADMIN), SystemController.getDashboardStats);
router.get("/analytics", auth(Role.ADMIN), SystemController.getDashboardAnalytics);
router.get("/activity/chart", auth(Role.ADMIN), SystemController.getUserActivityChart);
router.get("/activity/recent", auth(Role.ADMIN), SystemController.getRecentActivity);

export const SystemRouter = router;

