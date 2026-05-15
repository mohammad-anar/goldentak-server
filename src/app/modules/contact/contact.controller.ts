import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import { ContactService } from "./contact.service.js";

const sendContactEmail = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.sendContactEmail(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Your message has been sent successfully!",
    data: result,
  });
});

export const ContactController = {
  sendContactEmail,
};
