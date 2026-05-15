import { PrismaClient, RaceStatus } from "@prisma/client";

const prisma = new PrismaClient();

const getAllRaces = async (filters: any) => {
  const { date, location, status } = filters;
  
  return await prisma.race.findMany({
    where: {
      ...(date && { date: new Date(date) }),
      ...(location && { location }),
      ...(status && { status: status as RaceStatus }),
    },
    include: {
      _count: {
        select: { entries: true }
      }
    },
    orderBy: { time: 'asc' }
  });
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
