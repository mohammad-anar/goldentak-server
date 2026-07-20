import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { RaceService } from "./race.service.js";
import { PredictionRankingService } from "../../../algorithm/prediction-ranking.service.js";
import { pushRaceUpdate, registerSseClient } from "../../../helpers/sseHelper.js";
import redisClient from "../../../helpers/redis.js";

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM FIELD MASKING
// Free users can see the race list and basic horse info, but sensitive
// AI prediction fields are hidden/nulled unless the user has an active subscription.
// ─────────────────────────────────────────────────────────────────────────────
const PREMIUM_ENTRY_FIELDS = [
  "winProb",
  "winOddsFair",
  "placeProb",
  "eachWayProb",
  "goingSuitabilityScore",
  "distanceSuitabilityScore",
  "courseSpecialistScore",
  "drawBiasScore",
  "jockeyFormScore",
  "trainerFormScore",
  "aiSelectionRank",
  "aiConfidence",
  "aiConfidenceScore",
  "aiAnalysis",
  "horsePower",
  "jockeyPower",
  "normalizedScore",
  "rank",
  "category",
  "hasValueEdge",
  "valueEdgePercent",
];

const PREMIUM_RACE_FIELDS = [
  "tahmin1X",
  "riskRate",
  "predictionMessage",
];

function maskEntryForFreeUser(entry: any): any {
  const masked: any = { ...entry };
  for (const field of PREMIUM_ENTRY_FIELDS) {
    masked[field] = null;
  }
  return masked;
}

function maskRaceForFreeUser(race: any): any {
  if (!race) return race;
  const masked: any = { ...race };
  for (const field of PREMIUM_RACE_FIELDS) {
    masked[field] = null;
  }
  if (Array.isArray(masked.entries)) {
    masked.entries = masked.entries.map(maskEntryForFreeUser);
  }
  return masked;
}

function isPremiumUser(req: Request): boolean {
  const user = (req as any).user;
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return !!(
    user.subscription &&
    user.subscription.isActive &&
    (!user.subscription.endDate ||
      new Date(user.subscription.endDate) >= new Date())
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

const getAllRaces = async (req: Request, res: Response) => {
  try {
    const result = await RaceService.getAllRaces(req.query) as any;
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Races fetched successfully",
      meta: result.meta,
      data: result.data,
      isPremium: isPremiumUser(req),
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getRaceById = async (req: Request, res: Response) => {
  try {
    const raw = await RaceService.getRaceById(req.params.id as string);
    const premium = isPremiumUser(req);
    const data = premium ? raw : maskRaceForFreeUser(raw);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Race fetched successfully",
      isPremium: premium,
      data,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const calculateRaceScores = async (req: Request, res: Response) => {
  try {
    // Run the actual core ranking service
    const result = await PredictionRankingService.calculateForRace(req.params.id as string, "manual");

    // Invalidate Redis cache so next REST fetch returns fresh scored data
    try {
      await redisClient.del(`races:id:${req.params.id}`);
      await redisClient.del(`races:stats:${req.params.id}`);
    } catch (cacheErr) {
      console.warn("[Redis] Cache invalidation failed:", cacheErr);
    }

    // Push the updated entries to all SSE clients watching this race
    pushRaceUpdate(req.params.id as string, { entries: result });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Race analysis calculated successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const streamRace = async (req: Request, res: Response) => {
  const { id } = req.params;
  const premium = isPremiumUser(req);

  // Register this response as an SSE client.
  // The returned `cleanup` function removes the client from the registry.
  const cleanup = registerSseClient(id as string, res);

  // Remove the client when the connection drops
  req.on("close", cleanup);

  // If the race has existing scored data, push it immediately
  try {
    const raw = await RaceService.getRaceById(id as string) as any;
    if (raw && raw.hasPredictions) {
      const data = premium ? raw : maskRaceForFreeUser(raw);
      res.write(
        `event: race:snapshot\ndata: ${JSON.stringify({ raceId: id, isPremium: premium, ...data })}\n\n`
      );
    }
  } catch {
    // Non-fatal: snapshot is best-effort
  }
};

const getRaceDates = async (req: Request, res: Response) => {
  try {
    const result = await RaceService.getRaceDates(req.query.month as string);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Race dates fetched successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getRaceStatistics = async (req: Request, res: Response) => {
  try {
    const premium = isPremiumUser(req);
    if (!premium) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "Statistics are available for premium subscribers only.",
        isPremium: false,
      });
    }
    const result = await RaceService.getRaceStatistics(req.params.id as string);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Race statistics fetched successfully",
      isPremium: true,
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getRaceLocations = async (req: Request, res: Response) => {
  try {
    const result = await RaceService.getRaceLocations(req.query);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Race locations fetched successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

export const RaceController = {
  getAllRaces,
  getRaceById,
  calculateRaceScores,
  streamRace,
  getRaceDates,
  getRaceStatistics,
  getRaceLocations,
};
