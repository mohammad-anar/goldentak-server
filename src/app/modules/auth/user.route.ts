import express from "express";
import { UserController } from "./user.controller.js";
import { UserValidation } from "./user.validation.js";
import auth from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { Role } from "../../../types/enum.js";
import fileUploadHandler from "../../middlewares/fileUploadHandler.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User registration, login, and account management
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 type: string
 *                 description: JSON stringified payload matching RegisterBody
 *                 example: '{"name": "John Doe", "username": "johndoe", "email": "john@example.com", "password": "Password123!", "phone": "1234567890", "bio": "MMA Fan"}'
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image upload
 *     responses:
 *       201:
 *         description: Registration successful, OTP sent to email
 *       409:
 *         description: Email or username already taken
 */
router.post(
  "/register",
  fileUploadHandler(),
  (req, res, next) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(UserValidation.createUserZodSchema),
  UserController.createUser
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive JWT tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginBody'
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid password
 *       404:
 *         description: User not found
 */
router.post("/login", validateRequest(UserValidation.loginZodSchema), UserController.login);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email with OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
router.post("/verify-email", validateRequest(UserValidation.verifyEmailZodSchema), UserController.verifyUser);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend OTP to email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: OTP resent
 */
router.post("/resend-otp", UserController.resendOTP);

/**
 * @swagger
 * /auth/forget-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset link via email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset link sent
 */
router.post("/forget-password", validateRequest(UserValidation.forgetPasswordZodSchema), UserController.forgetPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post("/reset-password", auth(Role.USER, Role.ADMIN), validateRequest(UserValidation.resetPasswordZodSchema), UserController.resetPassword);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (requires old password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed
 */
router.post("/change-password", auth(Role.USER, Role.ADMIN), validateRequest(UserValidation.changePasswordZodSchema), UserController.changePassword);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     responses:
 *       200:
 *         description: New tokens issued
 */
router.post("/refresh", auth(Role.USER, Role.ADMIN), UserController.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and clear cookies
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post("/logout", auth(Role.USER, Role.ADMIN), UserController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     responses:
 *       200:
 *         description: User profile
 *   patch:
 *     tags: [Auth]
 *     summary: Update current user profile
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 type: string
 *                 description: JSON stringified payload matching UpdateUserBody
 *                 example: '{"name": "John Updated", "bio": "Updated bio", "location": "New York"}'
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image upload
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.get("/me", auth(Role.USER, Role.ADMIN), UserController.getMe);

router.patch(
  "/me",
  auth(Role.USER, Role.ADMIN, Role.USER),
  fileUploadHandler(),
  (req, res, next) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(UserValidation.updateUserZodSchema),
  UserController.updateUser
);

/**
 * @swagger
 * /auth/users:
 *   get:
 *     tags: [Auth]
 *     summary: Get all users (Admin only)
 *     parameters:
 *       - in: query
 *         name: searchTerm
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [USER, ADMIN] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Paginated user list
 */
router.get("/users", auth(Role.ADMIN), UserController.getAllUsers);

/**
 * @swagger
 * /auth/users/{id}:
 *   get:
 *     tags: [Auth]
 *     summary: Get user by ID (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 *   delete:
 *     tags: [Auth]
 *     summary: Soft-delete user (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 */
router.get("/users/:id", auth(Role.ADMIN), UserController.getUserById);
router.delete("/users/:id", auth(Role.ADMIN), UserController.deleteUser);

export const UserRouter = router;
