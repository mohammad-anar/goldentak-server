import config from "../../config/index.js";
import ApiError from "../../errors/ApiError.js";
import { NextFunction, Request, Response } from "express";
import { jwtHelper } from "../../helpers/jwtHelper.js";
import { StatusCodes } from "http-status-codes";
import { Secret } from "jsonwebtoken";

const auth =
  (...roles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokenWithBearer = req.headers.authorization;
      if (!tokenWithBearer) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
      }

      if (tokenWithBearer && !tokenWithBearer.startsWith("Bearer")) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Invalid Token format! Token must startsWith Bearer",
        );
      }
      if (tokenWithBearer && tokenWithBearer.startsWith("Bearer")) {
        const token = tokenWithBearer.split(" ")[1];

        //verify token
        const verifyUser = jwtHelper.verifyToken(
          token,
          config.jwt.jwt_secret as Secret,
        );
        //set user to header
        req.user = verifyUser;

        //guard user
        if (roles.length && !roles.includes(verifyUser.role)) {
          throw new ApiError(
            StatusCodes.FORBIDDEN,
            "You don't have permission to access this api",
          );
        }

        next();
      }
    } catch (error) {
      next(error);
    }
  };

export default auth;
