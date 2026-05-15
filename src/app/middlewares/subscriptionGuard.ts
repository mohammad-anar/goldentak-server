import ApiError from "../../errors/ApiError.js";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

const subscriptionGuard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    // Admin bypass
    if (user.role === 'ADMIN') {
      return next();
    }

    if (!user.subscription || !user.subscription.isActive) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Access Denied: This content requires an active subscription. Please upgrade your plan."
      );
    }

    // Check if subscription has expired (extra safety check if not handled in token generation)
    if (user.subscription.endDate && new Date(user.subscription.endDate) < new Date()) {
       throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Access Denied: Your subscription has expired. Please renew to continue."
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default subscriptionGuard;
