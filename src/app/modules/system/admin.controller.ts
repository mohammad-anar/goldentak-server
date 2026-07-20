import { Request, Response, NextFunction } from "express";
import { prisma } from "../../../helpers/prisma.js";
import { CacheService } from "../../../cache/cache.service.js";
import { AlgorithmSettingsService } from "../../../algorithm/algorithm-settings.service.js";
import { Queues, JOB_NAMES } from "../../../queues/queue.registry.js";
import ApiError from "../../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/algorithm-settings
// ─────────────────────────────────────────────────────────────────────────────
export const getAlgorithmSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const settings = await prisma.algorithmSetting.findMany({
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/algorithm-settings/:key
// ─────────────────────────────────────────────────────────────────────────────
export const updateAlgorithmSetting = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const key = req.params.key as string;
    const { value, note } = req.body as { value: number; note?: string };
    const changedBy = String((req as any).user?.userId ?? "admin");

    if (typeof value !== "number") {
      throw new ApiError(StatusCodes.BAD_REQUEST, "value must be a number");
    }

    const existing = await prisma.algorithmSetting.findUnique({ where: { key } });
    if (!existing) {
      throw new ApiError(StatusCodes.NOT_FOUND, `Setting "${key}" not found`);
    }

    // Validate within configured bounds
    if (existing.minValue !== null && existing.minValue !== undefined && value < existing.minValue) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `value must be >= ${existing.minValue}`);
    }
    if (existing.maxValue !== null && existing.maxValue !== undefined && value > existing.maxValue) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `value must be <= ${existing.maxValue}`);
    }

    const updated = await prisma.algorithmSetting.update({
      where: { key },
      data:  { value, updatedBy: changedBy },
    });

    // Persist history record
    await prisma.algorithmSettingHistory.create({
      data: {
        settingId: existing.id,
        oldValue:  existing.value,
        newValue:  value,
        changedBy,
        note:      note ?? null,
      },
    });

    // Immediately invalidate the algorithm settings cache
    await CacheService.invalidateAlgorithmSettings();

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/algorithm-settings/history
// ─────────────────────────────────────────────────────────────────────────────
export const getAlgorithmSettingHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const history = await prisma.algorithmSettingHistory.findMany({
      include: { setting: { select: { key: true, label: true } } },
      orderBy: { createdAt: "desc" },
      take:    100,
    });
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/algorithm/recalculate/:raceId
// ─────────────────────────────────────────────────────────────────────────────
export const triggerRecalculation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const raceId = req.params.raceId as string;

    const race = await prisma.race.findUnique({ where: { id: raceId }, select: { id: true, location: true } });
    if (!race) throw new ApiError(StatusCodes.NOT_FOUND, "Race not found");

    const job = await Queues.prediction.add(
      JOB_NAMES.CALCULATE_RACE,
      { raceId },
      { priority: 1 }
    );

    res.json({
      success: true,
      message: `Recalculation job enqueued for race: ${race.location}`,
      jobId:   job.id,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/sync-logs
// ─────────────────────────────────────────────────────────────────────────────
export const getSyncLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { service, status, limit = "50" } = req.query as Record<string, string>;
    const where: any = {};
    if (service) where.service = service;
    if (status)  where.status  = status;

    const logs = await prisma.syncLog.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take:    parseInt(limit, 10),
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/sync/trigger
// ─────────────────────────────────────────────────────────────────────────────
export const triggerManualSync = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type = "upcoming", days = 3 } = req.body;

    let job: any;
    if (type === "upcoming") {
      job = await Queues.race.add(JOB_NAMES.SYNC_UPCOMING_RACES, { days }, { priority: 1 });
    } else if (type === "results") {
      job = await Queues.result.add(JOB_NAMES.SYNC_PAST_RESULTS, { days }, { priority: 1 });
    } else {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'type must be "upcoming" or "results"');
    }

    res.json({ success: true, message: `Sync job enqueued`, jobId: job.id, type, days });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/queue/stats
// ─────────────────────────────────────────────────────────────────────────────
export const getQueueStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { Queues: Q } = await import("../../../queues/queue.registry.js");

    const stats = await Promise.all(
      Object.entries(Q).map(async ([name, queue]) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);
        return { queue: name, waiting, active, completed, failed, delayed };
      })
    );

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};
