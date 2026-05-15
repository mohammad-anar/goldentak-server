import { PrismaClient, RaceStatus } from "@prisma/client";
import { paginationHelper } from "../../../helpers/paginationHelper.js";

const prisma = new PrismaClient();

const getAllRaces = async (filters: any) => {
  const { date, location, status, ...options } = filters;
  const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);

  const where = {
    ...(date && { date: new Date(date) }),
    ...(location && { location }),
    ...(status && { status: status as RaceStatus }),
  };

  const [data, total] = await Promise.all([
    prisma.race.findMany({
      where,
      skip,
      take: limit,
      include: {
        _count: {
          select: { entries: true }
        }
      },
      orderBy: { [sortBy]: sortOrder }
    }),
    prisma.race.count({ where })
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit)
    },
    data
  };
};

const getRaceById = async (id: string) => {
  return await prisma.race.findUnique({
    where: { id },
    include: {
      entries: {
        include: {
          horse: true,
          jockey: true,
        },
        orderBy: { normalizedScore: 'desc' }
      },
      results: {
        include: {
          horse: true,
          jockey: true,
        }
      }
    }
  });
};

export const RaceService = {
  getAllRaces,
  getRaceById,
};
