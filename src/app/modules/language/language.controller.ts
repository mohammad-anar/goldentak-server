import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import { LanguageService } from "./language.service.js";

const updateUserLanguage = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).userId;
  const { language } = req.body;

  const result = await LanguageService.updateUserLanguage(userId, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Language preference updated successfully",
    data: result,
  });
});

const getLanguageOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await LanguageService.getLanguageOverview();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Language statistics fetched successfully",
    data: result,
  });
});

export const LanguageController = {
  updateUserLanguage,
  getLanguageOverview,
};
