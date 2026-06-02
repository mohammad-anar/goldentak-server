import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import { SystemService } from "./system.service.js";

const getLockdownStatus = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemService.getLockdownStatus();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Lockdown status retrieved",
    data: result,
  });
});

const enableLockdown = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemService.enableLockdown();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Saturday Lockdown ENABLED — all mutation routes are now blocked",
    data: result,
  });
});

const disableLockdown = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemService.disableLockdown();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Lockdown DISABLED — system is now open",
    data: result,
  });
});

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemService.getDashboardStats();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dashboard stats retrieved successfully",
    data: result,
  });
});

const getUserActivityChart = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemService.getUserActivityChart();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User activity chart data retrieved successfully",
    data: result,
  });
});

const getRecentActivity = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemService.getRecentActivity();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Recent activity retrieved successfully",
    data: result,
  });
});

const getDashboardAnalytics = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemService.getDashboardAnalytics();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dashboard analytics retrieved successfully",
    data: result,
  });
});

const getApiStats = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemService.getApiStats();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "API stats retrieved successfully",
    data: result,
  });
});

const getRaceResultsStats = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemService.getRaceResultsStats();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Race results stats retrieved successfully",
    data: result,
  });
});

export const SystemController = {
  getLockdownStatus,
  enableLockdown,
  disableLockdown,
  getDashboardStats,
  getUserActivityChart,
  getRecentActivity,
  getDashboardAnalytics,
  getApiStats,
  getRaceResultsStats,
};

