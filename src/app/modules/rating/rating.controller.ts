import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { RatingService } from "./rating.service.js";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";

const createRating = catchAsync(async (req: Request, res: Response) => {
  const { deviceId, rating, comment } = req.body;
  if (!deviceId || rating === undefined) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "deviceId and rating are required",
    });
  }

  const result = await RatingService.createRating({
    deviceId,
    rating: parseInt(rating, 10),
    comment,
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Rating submitted successfully! Thank you for your feedback.",
    data: result,
  });
});

const getAllRatings = catchAsync(async (req: Request, res: Response) => {
  const result = await RatingService.getAllRatings();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Ratings fetched successfully",
    data: result,
  });
});

export const RatingController = {
  createRating,
  getAllRatings,
};
