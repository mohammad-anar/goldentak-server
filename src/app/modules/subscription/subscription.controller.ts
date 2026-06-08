import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import { SubscriptionService } from "./subscription.service.js";

const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.createSubscription(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "User subscription updated successfully",
    data: result,
  });
});

const getSubscriptionOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.getSubscriptionOverview();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscription overview data fetched successfully",
    data: result,
  });
});

const getMySubscriptionStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await SubscriptionService.getSubscriptionByUserId(userId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscription status fetched successfully",
    data: result,
  });
});

export const SubscriptionController = {
  createSubscription,
  getSubscriptionOverview,
  getMySubscriptionStatus,
};



