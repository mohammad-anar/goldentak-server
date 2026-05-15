import { Prisma } from "@prisma/client";
import ApiError from "../../errors/ApiError.js";
import handleJWTError from "../../errors/handleJWTError.js";
import handlePrismaError from "../../errors/handlePrismaError.js";
import handleZodError from "../../errors/handleZodError.js";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import { IErrorMessage } from "../../types/errors.types.js";
import { ZodError } from "zod";

const { JsonWebTokenError, TokenExpiredError, NotBeforeError } = jwt as any;

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR;
  let message: string = "Something went wrong!";
  let errorMessages: IErrorMessage[] = [];

  // ── Zod Validation Error ──────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const simplified = handleZodError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorMessages = simplified.errorMessages;
  }

  // ── Prisma Known Request Errors ───────────────────────────────────────────
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const simplified = handlePrismaError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorMessages = simplified.errorMessages;
  }

  // ── Prisma Validation Error ───────────────────────────────────────────────
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = "Invalid data provided. Please check your request.";
    errorMessages = [{ path: "input", message }];
  }

  // ── Prisma Initialization / Connection Error ──────────────────────────────
  else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = StatusCodes.SERVICE_UNAVAILABLE;
    message = "Database connection failed. Please try again later.";
    errorMessages = [{ path: "database", message }];
  }

  // ── JWT Errors ────────────────────────────────────────────────────────────
  else if (
    err instanceof TokenExpiredError ||
    err instanceof JsonWebTokenError ||
    err instanceof NotBeforeError
  ) {
    const simplified = handleJWTError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorMessages = simplified.errorMessages;
  }

  // ── Custom API Error ──────────────────────────────────────────────────────
  else if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorMessages = [{ path: "error", message: err.message }];
  }

  // ── Generic / Standard Error ──────────────────────────────────────────────
  else if (err instanceof Error) {
    statusCode = (err as any).statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    message = err.message || "An unexpected error occurred.";
    errorMessages = [{ path: "error", message }];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorMessages,
    ...(process.env.NODE_ENV === "development" && { stack: err?.stack }),
  });
};

export default globalErrorHandler;
