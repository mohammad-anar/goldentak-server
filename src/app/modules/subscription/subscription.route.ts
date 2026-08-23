import express from "express";
import { SubscriptionController } from "./subscription.controller.js";
import auth from "../../middlewares/auth.js";

const router = express.Router();

// Administrative & Status Endpoints
router.get("/overview", auth("ADMIN"), SubscriptionController.getSubscriptionOverview);
router.get("/me", auth(), SubscriptionController.getMySubscriptionStatus);
router.post("/", auth("ADMIN"), SubscriptionController.createSubscription);

// Purchase Verification Endpoints (unauthenticated, deviceId provided in body)
router.post("/google/verify", SubscriptionController.verifyGoogleSubscription);
router.post("/apple/verify", SubscriptionController.verifyAppleSubscription);

// Webhook Endpoints
router.post("/webhooks/google", SubscriptionController.handleGoogleWebhook);
router.post("/webhooks/apple", SubscriptionController.handleAppleWebhook);

export const SubscriptionRouter = router;
