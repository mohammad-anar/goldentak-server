import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UserService } from "./user.service.js";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import ApiError from "../../../errors/ApiError.js";

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getAllUsers(req.query);
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Users fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getStats = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getSubscriptionStats();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Stats fetched successfully",
    data: result,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUserById(req.params.id);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User fetched successfully",
    data: result,
  });
});

const updateUserSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.updateUserSubscription(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscription updated successfully",
    data: result,
  });
});

const getCurrentLoginUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getCurrentLoginUsers(req.query);
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Current login users fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const UserController = {
  getAllUsers,
  getCurrentLoginUsers,
  getStats,
  getUserById,
  updateUserSubscription,
};
