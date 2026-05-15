import express from "express";
import { NewsletterController } from "./newsletter.controller.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { NewsletterValidation } from "./newsletter.validation.js";
import auth from "../../middlewares/auth.js";
import { Role } from "@prisma/client";
import fileUploadHandler from "../../middlewares/fileUploadHandler.js";

const router = express.Router();

/**
 * @swagger
 * /newsletter:
 *   post:
 *     tags: [Newsletter]
 *     summary: Create a new newsletter (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 $ref: '#/components/schemas/NewsletterBody'
 *                 description: >
 *                   JSON stringified payload containing title and rich text description.
 *                   Must be a valid JSON string.
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Newsletter header image
 *     responses:
 *       201:
 *         description: Newsletter created
 */
router.post(
  "/",
  auth(Role.ADMIN),
  fileUploadHandler(),
  (req, res, next) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(NewsletterValidation.createNewsletterZodSchema),
  NewsletterController.createNewsletter
);

/**
 * @swagger
 * /newsletter:
 *   get:
 *     tags: [Newsletter]
 *     summary: Get all newsletters
 *     parameters:
 *       - in: query
 *         name: searchTerm
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Newsletters retrieved
 */
router.get("/", NewsletterController.getAllNewsletters);

/**
 * @swagger
 * /newsletter/{id}:
 *   get:
 *     tags: [Newsletter]
 *     summary: Get newsletter by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Newsletter retrieved
 */
router.get("/:id", NewsletterController.getNewsletterById);

/**
 * @swagger
 * /newsletter/{id}:
 *   patch:
 *     tags: [Newsletter]
 *     summary: Update newsletter (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 $ref: '#/components/schemas/NewsletterBody'
 *                 description: JSON stringified payload (partial updates allowed)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: New newsletter header image
 *     responses:
 *       200:
 *         description: Newsletter updated
 */
router.patch(
  "/:id",
  auth(Role.ADMIN),
  fileUploadHandler(),
  (req, res, next) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(NewsletterValidation.updateNewsletterZodSchema),
  NewsletterController.updateNewsletter
);

/**
 * @swagger
 * /newsletter/{id}:
 *   delete:
 *     tags: [Newsletter]
 *     summary: Delete newsletter (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Newsletter deleted
 */
router.delete("/:id", auth(Role.ADMIN), NewsletterController.deleteNewsletter);

export const NewsletterRoutes = router;
