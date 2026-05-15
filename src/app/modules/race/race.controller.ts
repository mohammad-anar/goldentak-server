import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { RaceService } from "./race.service.js";
import { CalculationService } from "../analysis/calculation.service.js";

const getAllRaces = async (req: Request, res: Response) => {
  try {
    const result = await RaceService.getAllRaces(req.query);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Races fetched successfully",
      data: result,
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
    const result = await RaceService.getRaceById(req.params.id);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Race fetched successfully",
      data: result,
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
    const result = await CalculationService.calculateRaceScores(req.params.id);
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

export const RaceController = {
  getAllRaces,
  getRaceById,
  calculateRaceScores,
};
