import express from "express";
import { OddsController } from "./odds.controller.js";
import auth from "../../middlewares/auth.js";

const router = express.Router();

// Fetch current odds (subscribers/users)
router.get("/race/:raceId", auth(), OddsController.getOddsForRace);

// Fetch odds historical movement
router.get("/race/:raceId/history", auth(), OddsController.getOddsHistory);

// Admin-triggered odds manual refresh
router.post("/race/:raceId/sync", auth("ADMIN", "SUPER_ADMIN"), OddsController.syncOdds);

export const OddsRouter = router;
