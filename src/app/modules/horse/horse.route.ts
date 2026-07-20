import express from "express";
import { HorseController } from "./horse.controller.js";
import auth from "../../middlewares/auth.js";
import subscriptionGuard from "../../middlewares/subscriptionGuard.js";

const router = express.Router();

router.get("/search", auth(), subscriptionGuard, HorseController.searchHorses);
router.get("/:id", auth(), subscriptionGuard, HorseController.getHorseById);
router.get("/:id/analysis/:type", auth(), subscriptionGuard, HorseController.getHorseAnalysis);

export const HorseRouter = router;
