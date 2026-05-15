import express from "express";
import { SubscriptionController } from "./subscription.controller.js";

const router = express.Router();

router.get("/plans", SubscriptionController.getAllPlans);
router.get("/plans/:id", SubscriptionController.getPlanById);
router.post("/plans", SubscriptionController.createPlan);
router.patch("/plans/:id", SubscriptionController.updatePlan);
router.post("/", SubscriptionController.createSubscription);




export const SubscriptionRouter = router;
