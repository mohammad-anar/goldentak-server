import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const searchHorses = async (name: string) => {
  return await prisma.horse.findMany({
    where: {
      name: { contains: name, mode: 'insensitive' }
    },
    take: 10
  });
};

const getHorseById = async (id: string) => {
  return await prisma.horse.findUnique({
    where: { id },
    include: {
      results: {
        include: { race: true },
        orderBy: { race: { date: 'desc' } }
      }
    }
  });
};

export const HorseService = {
  searchHorses,
  getHorseById,
};
