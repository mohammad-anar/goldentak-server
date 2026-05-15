import { Request, Response } from "express";
import { NotificationService } from "./notification.service.js";
import sendResponse from "../../shared/sendResponse.js";
import { StatusCodes } from "http-status-codes";

const getMyNotifications = async (req: Request, res: Response) => {
  const userId = (req.user as any).userId;
  const result = await NotificationService.getMyNotifications(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notifications fetched successfully",
    data: result,
  });
};

const markAsRead = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await NotificationService.markAsRead(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notification marked as read",
    data: result,
  });
};

const markAllAsRead = async (req: Request, res: Response) => {
  const userId = (req.user as any).userId;
  const result = await NotificationService.markAllAsRead(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "All notifications marked as read",
    data: result,
  });
};

export const NotificationController = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
