import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { SystemSettingsService } from "./system.settings.service.js";

const getAlgorithmSettings = async (req: Request, res: Response) => {
  try {
    const result = await SystemSettingsService.getAlgorithmSettings();
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Algorithm settings fetched successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const updateAlgorithmSettings = async (req: Request, res: Response) => {
  try {
    const result = await SystemSettingsService.updateAlgorithmSettings(req.body);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Algorithm settings updated successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

export const SystemSettingsController = {
  getAlgorithmSettings,
  updateAlgorithmSettings,
};
