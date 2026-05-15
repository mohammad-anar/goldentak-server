import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync.js';
import sendResponse from '../../shared/sendResponse.js';
import { LegalService } from './legal.service.js';

const createOrUpdate = catchAsync(async (req: Request, res: Response) => {
  const { type, content } = req.body;
  const result = await LegalService.createOrUpdate(type, content);
  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Legal document updated successfully',
    data: result,
  });
});

const getByType = catchAsync(async (req: Request, res: Response) => {
  const result = await LegalService.getByType(req.params.type as string);
  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Legal document fetched successfully',
    data: result,
  });
});

const getAll = catchAsync(async (req: Request, res: Response) => {
  const result = await LegalService.getAll();
  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All legal documents fetched successfully',
    data: result,
  });
});

export const LegalController = {
  createOrUpdate,
  getByType,
  getAll,
};
