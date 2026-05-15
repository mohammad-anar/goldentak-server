import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { jwtHelper } from "../../../helpers/jwtHelper.js";
import config from "../../../config/index.js";
import { Secret } from "jsonwebtoken";
import ApiError from "../../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import { emailHelper } from "../../../helpers/emailHelper.js";
import generateOTP from "../../../helpers/generateOTP.js";
import redisClient from "../../../helpers/redis.js";

const prisma = new PrismaClient();

const login = async (payload: any) => {
  const { email, password } = payload;

  const isExist = await prisma.user.findUnique({
    where: { email },
  });

  if (!isExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User does not exist");
  }

  if (isExist.role !== 'ADMIN') {
    throw new ApiError(StatusCodes.FORBIDDEN, "Access denied: Admins only");
  }

  const isPasswordMatch = await bcrypt.compare(password, isExist.passwordHash!);
  if (!isPasswordMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Password does not match");
  }

  const accessToken = jwtHelper.createToken(
    { userId: isExist.id, role: isExist.role, email: isExist.email },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as any
  );

  return {
    accessToken,
    user: isExist
  };
};

const changePassword = async (userId: string, payload: any) => {
  const { oldPassword, newPassword } = payload;

  const isExist = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!isExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User does not exist");
  }

  const isPasswordMatch = await bcrypt.compare(oldPassword, isExist.passwordHash!);
  if (!isPasswordMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Old password does not match");
  }

  const newPasswordHash = await bcrypt.hash(newPassword, config.bcrypt_salt_round);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  return { message: "Password changed successfully" };
};

const forgotPassword = async (email: string) => {
  const isExist = await prisma.user.findUnique({
    where: { email },
  });

  if (!isExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User does not exist");
  }

  const otp = generateOTP();
  
  // Store OTP in Redis for 5 minutes
  await redisClient.setEx(`otp:${email}`, 300, otp.toString());

  await emailHelper.sendEmail({
    to: email,
    subject: "Reset Password OTP",
    html: `<div>Your OTP for password reset is: <b>${otp}</b>. It will expire in 5 minutes.</div>`,
  });

  return { message: "OTP sent to your email" };
};

const verifyOTP = async (email: string, otp: string) => {
  const storedOTP = await redisClient.get(`otp:${email}`);

  if (!storedOTP || storedOTP !== otp) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid or expired OTP");
  }

  return { message: "OTP verified successfully" };
};

const resetPassword = async (payload: any) => {
  const { email, otp, newPassword } = payload;

  const storedOTP = await redisClient.get(`otp:${email}`);
  if (!storedOTP || storedOTP !== otp) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid or expired OTP");
  }

  const isExist = await prisma.user.findUnique({
    where: { email },
  });

  if (!isExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User does not exist");
  }

  const newPasswordHash = await bcrypt.hash(newPassword, config.bcrypt_salt_round);

  await prisma.user.update({
    where: { email },
    data: { passwordHash: newPasswordHash },
  });

  // Delete OTP after reset
  await redisClient.del(`otp:${email}`);

  return { message: "Password reset successfully" };
};

export const AdminAuthService = {
  login,
  changePassword,
  forgotPassword,
  verifyOTP,
  resetPassword
};
