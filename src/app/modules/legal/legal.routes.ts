import express from 'express';
import { LegalController } from './legal.controller.js';
import auth from "../../middlewares/auth.js";
import { Role } from '@prisma/client';

const router = express.Router();

router.post('/', auth(Role.ADMIN), LegalController.createOrUpdate);
router.get('/:type', LegalController.getByType);
router.get('/', LegalController.getAll);

export const LegalRouter = router;
