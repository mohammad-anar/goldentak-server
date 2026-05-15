import express from "express";
import validateRequest from "../../middlewares/validateRequest.js";
import { ContactController } from "./contact.controller.js";
import { ContactValidation } from "./contact.validation.js";

const router = express.Router();

/**
 * @swagger
 * /contact:
 *   post:
 *     tags: [Contact]
 *     summary: Send an email via the contact form
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, subject, message]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               subject: { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Email sent successfully
 */
router.post(
  "/",
  validateRequest(ContactValidation.sendContactEmailZodSchema),
  ContactController.sendContactEmail
);

export const ContactRoutes = router;
