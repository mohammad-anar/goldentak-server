import { Request, Response } from "express";
import { NotificationService } from "./notification.service.js";
import sendResponse from "../../shared/sendResponse.js";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../shared/catchAsync.js";

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).userId;
  const result = await NotificationService.getMyNotifications(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notifications fetched successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await NotificationService.markAsRead(id as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notification marked as read",
    data: result,
  });
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).userId;
  const result = await NotificationService.markAllAsRead(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "All notifications marked as read",
    data: result,
  });
});

const registerDeviceToken = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).userId;
  const { fcmToken, platform } = req.body;
  const result = await NotificationService.registerDeviceToken(userId, fcmToken, platform);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "FCM token registered successfully",
    data: result,
  });
});

const sendCustomNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.sendCustomNotification(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Custom notification sent successfully",
    data: result,
  });
});

const getBroadcastNotifications = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getBroadcastNotifications();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Recent broadcast notifications fetched successfully",
    data: result,
  });
});

const getNotificationStats = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getNotificationStats();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notification stats fetched successfully",
    data: result,
  });
});

export const NotificationController = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  sendCustomNotification,
  getBroadcastNotifications,
  getNotificationStats,
};
