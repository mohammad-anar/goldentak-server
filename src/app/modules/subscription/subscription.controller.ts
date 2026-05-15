import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import { SubscriptionService } from "./subscription.service.js";

const getAllPlans = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.getAllPlans();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscription plans fetched successfully",
    data: result,
  });
});

const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.getPlanById(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscription plan fetched successfully",
    data: result,
  });
});

const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.createSubscription(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "User subscription updated successfully",
    data: result,
  });
});

const createPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.createPlan(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Subscription plan created successfully",
    data: result,
  });
});

const updatePlan = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.updatePlan(req.params.id, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscription plan updated successfully",
    data: result,
  });
});

export const SubscriptionController = {
  getAllPlans,
  getPlanById,
  createSubscription,
  createPlan,
  updatePlan,
};



