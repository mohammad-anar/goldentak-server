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
      meta: result.meta,
      data: result.data,
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
    const result = await RaceService.getRaceStatistics(req.params.id);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Race statistics fetched successfully",
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
  getRaceDates,
  getRaceStatistics,
  getRaceLocations,
};

