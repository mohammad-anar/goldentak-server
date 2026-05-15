import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { DeviceAuthService } from "./device-auth.service.js";

const deviceLogin = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Device ID is required",
      });
    }

    const result = await DeviceAuthService.deviceLogin(deviceId);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Device logged in successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const purchaseSubscription = async (req: Request, res: Response) => {
  try {
    const { deviceId, plan, durationDays } = req.body;
    const result = await DeviceAuthService.handleSubscriptionPurchase(deviceId, plan, durationDays);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Subscription updated successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

export const DeviceAuthController = {
  deviceLogin,
  purchaseSubscription,
};
