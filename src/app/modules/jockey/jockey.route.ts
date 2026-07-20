import express from "express";
import { JockeyController } from "./jockey.controller.js";
import auth from "../../middlewares/auth.js";
import subscriptionGuard from "../../middlewares/subscriptionGuard.js";

const router = express.Router();

// Search jockeys (auth + premium subscription check)
router.get("/search", auth(), subscriptionGuard, JockeyController.searchJockeys);

// Get jockey details by ID
router.get("/:id", auth(), subscriptionGuard, JockeyController.getJockeyById);

// Get jockey analysis breakdown
router.get("/:id/analysis/:type", auth(), subscriptionGuard, JockeyController.getJockeyAnalysis);

export const JockeyRouter = router;
