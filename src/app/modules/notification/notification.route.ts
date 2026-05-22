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
  "/register-token",
  auth("ADMIN", "USER"),
  NotificationController.registerDeviceToken
);

router.post(
  "/send-custom",
  auth("ADMIN"),
  NotificationController.sendCustomNotification
);

router.get(
  "/recent",
  auth("ADMIN"),
  NotificationController.getBroadcastNotifications
);

router.get(
  "/stats",
  auth("ADMIN"),
  NotificationController.getNotificationStats
);

router.patch(
  "/:id/read",
  auth("ADMIN", "USER"),
  NotificationController.markAsRead
);

export const NotificationRoutes = router;
