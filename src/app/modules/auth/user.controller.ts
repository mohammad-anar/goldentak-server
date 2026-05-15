import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UserService } from "./user.service.js";

const getAllUsers = async (req: Request, res: Response) => {
  try {
    const result = await UserService.getAllUsers();
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Users fetched successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getStats = async (req: Request, res: Response) => {
  try {
    const result = await UserService.getSubscriptionStats();
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Stats fetched successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

export const UserController = {
  getAllUsers,
  getStats,
};
