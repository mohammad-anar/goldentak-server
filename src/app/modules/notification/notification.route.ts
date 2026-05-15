import express from "express";
import { NotificationController } from "./notification.controller.js";
import auth from "../../middlewares/auth.js";

const router = express.Router();

router.get(
  "/",
  auth("ADMIN", "USER"),
  NotificationController.getMyNotifications
);

router.patch(
  "/mark-all-read",
  auth("ADMIN", "USER"),
  NotificationController.markAllAsRead
);

router.patch(
  "/:id/read",
  auth("ADMIN", "USER"),
  NotificationController.markAsRead
);

export const NotificationRoutes = router;
