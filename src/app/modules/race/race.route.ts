import express from "express";
import { RaceController } from "./race.controller.js";
import auth from "../../middlewares/auth.js";
import subscriptionGuard from "../../middlewares/subscriptionGuard.js";

const router = express.Router();

router.get("/", auth(), subscriptionGuard, RaceController.getAllRaces);
router.get("/dates", auth(), subscriptionGuard, RaceController.getRaceDates);
router.get("/:id", auth(), subscriptionGuard, RaceController.getRaceById);
router.get("/:id/statistics", auth(), subscriptionGuard, RaceController.getRaceStatistics);
router.post("/:id/calculate", auth("ADMIN"), RaceController.calculateRaceScores);

export const RaceRouter = router;
