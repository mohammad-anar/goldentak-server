import { Prisma } from "@prisma/client";
import { IErrorMessage } from "../types/errors.types.js";

const handlePrismaError = (
  err: Prisma.PrismaClientKnownRequestError
): { statusCode: number; message: string; errorMessages: IErrorMessage[] } => {
  let statusCode = 400;
  let message = "Database error";
  let errorMessages: IErrorMessage[] = [];

  switch (err.code) {
    // Unique constraint violation
    case "P2002": {
      const fields = (err.meta?.target as string[]) || ["field"];
      message = `Duplicate value: ${fields.join(", ")} already exists.`;
      errorMessages = [{ path: fields.join(", "), message }];
      break;
    }

    // Record not found
    case "P2001":
    case "P2018":
    case "P2025": {
      statusCode = 404;
      const model = (err.meta?.modelName as string) || "Record";
      message = `${model} not found.`;
      errorMessages = [{ path: "id", message }];
      break;
    }

    // Foreign key constraint failed
    case "P2003": {
      const field = (err.meta?.field_name as string) || "relation";
      message = `Related record not found for field: ${field}.`;
      errorMessages = [{ path: field, message }];
      break;
    }

    // Required field missing
    case "P2011": {
      const field = (err.meta?.constraint as string) || "field";
      message = `Required field missing: ${field}.`;
      errorMessages = [{ path: field, message: `${field} is required.` }];
      break;
    }

    // Null constraint violation
    case "P2012": {
      const field = (err.meta?.path as string) || "field";
      message = `Missing required value for: ${field}.`;
      errorMessages = [{ path: field, message }];
      break;
    }

    // Value too long
    case "P2000": {
      const field = (err.meta?.column_name as string) || "field";
      message = `Value too long for field: ${field}.`;
      errorMessages = [{ path: field, message }];
      break;
    }

    // Value not in enum
    case "P2009": {
      message = "Invalid value provided for an enum field.";
      errorMessages = [{ path: "field", message }];
      break;
    }

    // Invalid ID / malformed input
    case "P2023": {
      message = "Inconsistent column data. Please check your input.";
      errorMessages = [{ path: "input", message }];
      break;
    }

    default: {
      message = `A database error occurred (code: ${err.code}).`;
      errorMessages = [{ path: "database", message }];
    }
  }

  return { statusCode, message, errorMessages };
};

export default handlePrismaError;
