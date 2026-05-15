import { Prisma } from "@prisma/client";
import { prisma } from "../../../helpers/prisma.js";
import ApiError from "../../../errors/ApiError.js";
import { paginationHelper } from "../../../helpers/paginationHelper.js";
import { INewsletter, INewsletterFilterRequest } from "./newsletter.interface.js";

const createNewsletter = async (payload: INewsletter) => {
  return prisma.newsletter.create({ data: payload });
};

const getAllNewsletters = async (
  filters: INewsletterFilterRequest,
  options: { page?: number; limit?: number; sortBy?: string; sortOrder?: string }
) => {
  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);

  const andConditions: Prisma.NewsletterWhereInput[] = [];

  if (filters.searchTerm) {
    andConditions.push({
      OR: ["title", "description"].map((field) => ({
        [field]: { contains: filters.searchTerm, mode: "insensitive" },
      })),
    });
  }

  const where: Prisma.NewsletterWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.newsletter.findMany({
    where,
    skip,
    take: limit,
    orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
  });

  const total = await prisma.newsletter.count({ where });

  return {
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
    data: result,
  };
};

const getNewsletterById = async (id: string) => {
  const result = await prisma.newsletter.findUnique({ where: { id } });
  if (!result) throw new ApiError(404, "Newsletter not found");
  return result;
};

const updateNewsletter = async (id: string, payload: Partial<INewsletter>) => {
  const isExist = await prisma.newsletter.findUnique({ where: { id } });
  if (!isExist) throw new ApiError(404, "Newsletter not found");

  return prisma.newsletter.update({ where: { id }, data: payload });
};

const deleteNewsletter = async (id: string) => {
  const isExist = await prisma.newsletter.findUnique({ where: { id } });
  if (!isExist) throw new ApiError(404, "Newsletter not found");

  return prisma.newsletter.delete({ where: { id } });
};

export const NewsletterService = {
  createNewsletter,
  getAllNewsletters,
  getNewsletterById,
  updateNewsletter,
  deleteNewsletter,
};
