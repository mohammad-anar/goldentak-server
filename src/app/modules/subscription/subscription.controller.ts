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

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE VERIFICATION CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

const verifyGoogleSubscription = catchAsync(async (req: Request, res: Response) => {
  const { deviceId, productId, purchaseToken, planId } = req.body;
  if (!deviceId || !productId || !purchaseToken) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "deviceId, productId, and purchaseToken are required fields",
    });
  }

  const result = await SubscriptionService.verifyGoogleSubscription(deviceId, productId, purchaseToken, planId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Google Play subscription verified successfully",
    data: result,
  });
});

const verifyAppleSubscription = catchAsync(async (req: Request, res: Response) => {
  const { deviceId, signedTransactionInfo, receiptData, transactionId, productId } = req.body;
  const receipt = receiptData || signedTransactionInfo;

  if (!deviceId || (!receipt && !transactionId)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "deviceId and at least one of receiptData, signedTransactionInfo, or transactionId are required fields",
    });
  }

  const result = await SubscriptionService.verifyAppleSubscription(deviceId, {
    signedTransactionInfo,
    receiptData,
    transactionId,
    productId,
    deviceId,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "App Store subscription verified successfully",
    data: result,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

const handleGoogleWebhook = catchAsync(async (req: Request, res: Response) => {
  // Google Cloud Pub/Sub sends notifications wrapped inside message object
  const pubSubMessage = req.body?.message;
  const result = await SubscriptionService.handleGoogleWebhook(pubSubMessage);
  res.status(StatusCodes.OK).json(result);
});

const handleAppleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signedPayload = req.body?.signedPayload;
  const result = await SubscriptionService.handleAppleWebhook(signedPayload);
  res.status(StatusCodes.OK).json(result);
});

export const SubscriptionController = {
  createSubscription,
  getSubscriptionOverview,
  getMySubscriptionStatus,
  verifyGoogleSubscription,
  verifyAppleSubscription,
  handleGoogleWebhook,
  handleAppleWebhook,
};
