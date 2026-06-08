import express from "express";
import { SubscriptionController } from "./subscription.controller.js";
import auth from "../../middlewares/auth.js";

const router = express.Router();

router.get("/overview", auth("ADMIN"), SubscriptionController.getSubscriptionOverview);
router.get("/me", auth(), SubscriptionController.getMySubscriptionStatus);
router.post("/", auth("ADMIN"), SubscriptionController.createSubscription);

export const SubscriptionRouter = router;
