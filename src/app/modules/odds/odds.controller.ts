import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { OddsService } from "./odds.service.js";

const getOddsForRace = async (req: Request, res: Response) => {
  try {
    const raceId = req.params.raceId as string;
    const odds = await OddsService.getOddsForRace(raceId);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Current odds retrieved successfully",
      data: odds,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getOddsHistory = async (req: Request, res: Response) => {
  try {
    const raceId = req.params.raceId as string;
    const history = await OddsService.getOddsHistory(raceId);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Odds history retrieved successfully",
      data: history,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const syncOdds = async (req: Request, res: Response) => {
  try {
    const raceId = req.params.raceId as string;
    const result = await OddsService.triggerManualOddsSync(raceId);
    res.status(StatusCodes.OK).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

export const OddsController = {
  getOddsForRace,
  getOddsHistory,
  syncOdds,
};
