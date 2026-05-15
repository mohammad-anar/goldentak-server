import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { SyncService } from "./sync.service.js";

const syncRaces = async (req: Request, res: Response) => {
  try {
    const result = await SyncService.syncUpcomingRaces();
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Races synchronized successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

export const SyncController = {
  syncRaces,
};
