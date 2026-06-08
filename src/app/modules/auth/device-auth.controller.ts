import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { DeviceAuthService } from "./device-auth.service.js";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";

const deviceLogin = catchAsync(async (req: Request, res: Response) => {
  const { deviceId } = req.body;
  if (!deviceId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Device ID is required",
    });
  }

  const result = await DeviceAuthService.deviceLogin(deviceId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Device logged in successfully",
    data: result,
  });
});

const purchaseSubscription = catchAsync(async (req: Request, res: Response) => {
  const { deviceId, planId, duration } = req.body;
  const result = await DeviceAuthService.handleSubscriptionPurchase(deviceId, duration || planId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscription updated successfully",
    data: result,
  });
});

export const DeviceAuthController = {
  deviceLogin,
  purchaseSubscription,
};
