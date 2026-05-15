import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { HorseService } from "./horse.service.js";

const searchHorses = async (req: Request, res: Response) => {
  try {
    const result = await HorseService.searchHorses(req.query.name as string);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Horses fetched successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getHorseById = async (req: Request, res: Response) => {
  try {
    const result = await HorseService.getHorseById(req.params.id);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Horse fetched successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

export const HorseController = {
  searchHorses,
  getHorseById,
};
