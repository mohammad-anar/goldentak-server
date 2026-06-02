import express from "express";
import { RatingController } from "./rating.controller.js";
import auth from "../../middlewares/auth.js";

const router = express.Router();

router.post("/", RatingController.createRating);
router.get("/", auth("ADMIN"), RatingController.getAllRatings);

export const RatingRoutes = router;
