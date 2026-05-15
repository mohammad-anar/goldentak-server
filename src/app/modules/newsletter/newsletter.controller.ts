import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../../helpers/pick.js";
import { NewsletterService } from "./newsletter.service.js";
import { getSingleFilePath } from "../../shared/getFilePath.js";

const createNewsletter = catchAsync(async (req: Request, res: Response) => {
  const image = getSingleFilePath(req.files, "image");
  if (image) {
    req.body.image = image;
  }

  const result = await NewsletterService.createNewsletter(req.body);
  sendResponse(res, { statusCode: 201, success: true, message: "Newsletter created successfully", data: result });
});

const getAllNewsletters = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, ["searchTerm"]);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const result = await NewsletterService.getAllNewsletters(filters, options);
  sendResponse(res, { statusCode: 200, success: true, message: "Newsletters retrieved successfully", data: result });
});

const getNewsletterById = catchAsync(async (req: Request, res: Response) => {
  const result = await NewsletterService.getNewsletterById(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Newsletter retrieved successfully", data: result });
});

const updateNewsletter = catchAsync(async (req: Request, res: Response) => {
  const image = getSingleFilePath(req.files, "image");
  if (image) {
    req.body.image = image;
  }

  const result = await NewsletterService.updateNewsletter(req.params.id, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Newsletter updated successfully", data: result });
});

const deleteNewsletter = catchAsync(async (req: Request, res: Response) => {
  const result = await NewsletterService.deleteNewsletter(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Newsletter deleted successfully", data: result });
});

export const NewsletterController = {
  createNewsletter,
  getAllNewsletters,
  getNewsletterById,
  updateNewsletter,
  deleteNewsletter,
};
