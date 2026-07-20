import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { RatingService } from "./rating.service.js";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import { jwtHelper } from "../../../helpers/jwtHelper.js";
import config from "../../../config/index.js";
import { Secret } from "jsonwebtoken";

const createRating = catchAsync(async (req: Request, res: Response) => {
  const { rating, comment } = req.body;
  let deviceId = req.body.deviceId;

  if (!deviceId) {
    const tokenWithBearer = req.headers.authorization;
    if (tokenWithBearer && tokenWithBearer.startsWith("Bearer ")) {
      try {
        const token = tokenWithBearer.split(" ")[1];
        const verifyUser = jwtHelper.verifyToken(token, config.jwt.jwt_secret as Secret);
        deviceId = verifyUser?.deviceId;
      } catch (err) {
        // ignore verification error
      }
    }
  }

  // fallback to default if still not resolved
  if (!deviceId) {
    deviceId = "unknown_device";
  }

  if (rating === undefined) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "rating is required",
    });
  }

  const result = await RatingService.createRating({
    deviceId,
    rating: parseInt(rating as any, 10),
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
