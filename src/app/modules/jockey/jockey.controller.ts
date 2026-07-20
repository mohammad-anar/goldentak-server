import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { JockeyService } from "./jockey.service.js";

const searchJockeys = async (req: Request, res: Response) => {
  try {
    const name = req.query.name as string;
    if (!name) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Query parameter 'name' is required",
      });
    }
    const jockeys = await JockeyService.searchJockeys(name);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Jockeys retrieved successfully",
      data: jockeys,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getJockeyById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const jockey = await JockeyService.getJockeyById(id);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Jockey details retrieved successfully",
      data: jockey,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getJockeyAnalysis = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const type = req.params.type as string;
    if (!["courses", "distances", "trainers", "owners"].includes(type)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid analysis type. Allowed: courses, distances, trainers, owners",
      });
    }
    const analysis = await JockeyService.getJockeyAnalysis(id, type as any);
    res.status(StatusCodes.OK).json({
      success: true,
      message: `Jockey analysis (${type}) retrieved successfully`,
      data: analysis,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

export const JockeyController = {
  searchJockeys,
  getJockeyById,
  getJockeyAnalysis,
};
