import express from "express";
import auth from "../../middlewares/auth.js";
import { LanguageController } from "./language.controller.js";

const router = express.Router();

// PATCH /language - update user language preference (accessible by ADMIN and USER)
router.patch("/", auth("ADMIN", "USER"), LanguageController.updateUserLanguage);

// GET /language/stats - retrieve language overview/stats (accessible by ADMIN)
router.get("/stats", auth("ADMIN"), LanguageController.getLanguageOverview);

export const LanguageRouter = router;
