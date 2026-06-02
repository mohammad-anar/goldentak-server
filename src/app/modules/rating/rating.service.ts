import { prisma } from "../../../helpers/prisma.js";

const createRating = async (payload: { deviceId: string; rating: number; comment?: string }) => {
  return await prisma.rating.create({
    data: payload,
  });
};

const getAllRatings = async () => {
  return await prisma.rating.findMany({
    orderBy: { createdAt: "desc" },
  });
};

export const RatingService = {
  createRating,
  getAllRatings,
};
