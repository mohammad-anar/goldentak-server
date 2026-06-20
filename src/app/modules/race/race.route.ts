import express from "express";
import { RaceController } from "./race.controller.js";
import auth from "../../middlewares/auth.js";

const router = express.Router();

// All authenticated users can fetch races & details.
// Premium-only fields (winProb, aiAnalysis, etc.) are masked
// in the controller for non-subscribers.
router.get("/", auth(), RaceController.getAllRaces);
router.get("/dates", auth(), RaceController.getRaceDates);
router.get("/locations", auth(), RaceController.getRaceLocations);

// ── SSE live stream ──────────────────────────────────────────────────────────
// Must be declared BEFORE /:id to avoid Express treating "stream" as an id param.
// Keeps the HTTP connection open and pushes Server-Sent Events on race updates.
router.get("/:id/stream", auth(), RaceController.streamRace);

router.get("/:id", auth(), RaceController.getRaceById);
router.get("/:id/statistics", auth(), RaceController.getRaceStatistics);

// Admin-only: trigger calculation
router.post("/:id/calculate", auth("ADMIN"), RaceController.calculateRaceScores);

export const RaceRouter = router;
