import express from "express";
import { DeviceAuthController } from "./device-auth.controller.js";
import { UserController } from "./user.controller.js";
import { AdminAuthController } from "./admin-auth.controller.js";
import auth from "../../middlewares/auth.js";

const router = express.Router();

// Device Auth (App)
router.post("/device-login", DeviceAuthController.deviceLogin);
router.post("/purchase-subscription", DeviceAuthController.purchaseSubscription);

// Admin Auth (Dashboard)
router.post("/login", AdminAuthController.login);
router.post("/change-password", auth("ADMIN"), AdminAuthController.changePassword);
router.post("/forgot-password", AdminAuthController.forgotPassword);
router.post("/verify-otp", AdminAuthController.verifyOTP);
router.post("/reset-password", AdminAuthController.resetPassword);

// Admin User Management
router.get("/users", auth("ADMIN"), UserController.getAllUsers);
router.get("/current-login-users", auth("ADMIN"), UserController.getCurrentLoginUsers);
router.post("/users/update-subscription", auth("ADMIN"), UserController.updateUserSubscription);
router.get("/users/:id", auth("ADMIN"), UserController.getUserById);
router.get("/stats", auth("ADMIN"), UserController.getStats);



export const AuthRoutes = router;
