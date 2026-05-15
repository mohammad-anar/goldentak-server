import jwt from "jsonwebtoken";
import { IErrorMessage } from "../types/errors.types.js";

const { JsonWebTokenError, TokenExpiredError, NotBeforeError } = jwt as any;


const handleJWTError = (
  err: any
): { statusCode: number; message: string; errorMessages: IErrorMessage[] } => {
  let message = "Authentication failed.";

  if (err instanceof TokenExpiredError) {
    message = "Your session has expired. Please log in again.";
  } else if (err instanceof NotBeforeError) {
    message = "Token is not yet active. Please try again later.";
  } else if (err instanceof JsonWebTokenError) {
    switch (err.message) {
      case "invalid signature":
        message = "Invalid token signature. Please log in again.";
        break;
      case "jwt malformed":
        message = "Malformed token. Please log in again.";
        break;
      case "invalid token":
        message = "Invalid token. Please log in again.";
        break;
      default:
        message = "Authentication failed. Please log in again.";
    }
  }

  return {
    statusCode: 401,
    message,
    errorMessages: [{ path: "authorization", message }],
  };
};

export default handleJWTError;
