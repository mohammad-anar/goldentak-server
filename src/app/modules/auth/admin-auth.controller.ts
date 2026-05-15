import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AdminAuthService } from "./admin-auth.service.js";

const login = async (req: Request, res: Response) => {
  try {
    const result = await AdminAuthService.login(req.body);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Admin logged in successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const result = await AdminAuthService.changePassword(userId, req.body);
    res.status(StatusCodes.OK).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = await AdminAuthService.forgotPassword(email);
    res.status(StatusCodes.OK).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const result = await AdminAuthService.verifyOTP(email, otp);
    res.status(StatusCodes.OK).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const resetPassword = async (req: Request, res: Response) => {
  try {
    const result = await AdminAuthService.resetPassword(req.body);
    res.status(StatusCodes.OK).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

export const AdminAuthController = {
  login,
  changePassword,
  forgotPassword,
  verifyOTP,
  resetPassword,
};
