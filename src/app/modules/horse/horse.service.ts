import { prisma } from "../../../helpers/prisma.js";
import { EnrichmentService } from "../analysis/enrichment.service.js";

const searchHorses = async (name: string) => {
  return await prisma.horse.findMany({
    where: {
      name: { contains: name, mode: "insensitive" },
    },
    take: 20,
  });
};

const getHorseById = async (id: string) => {
  const horse = await prisma.horse.findUnique({
    where: { id },
    include: {
      results: {
        include: { race: true },
        orderBy: { race: { date: "desc" } },
      },
      sireModel: true,
      damModel: true,
      damSireModel: true,
    },
  });

  if (!horse) throw new Error("Horse not found");

  // Proactively enrich if stale (older than 24 hours) or never enriched
  const isStale =
    !horse.enrichedAt ||
    Date.now() - new Date(horse.enrichedAt).getTime() > 24 * 60 * 60 * 1000;

  if (isStale && horse.externalId) {
    EnrichmentService.enrichHorse(horse.id, horse.externalId).catch((err) =>
      console.error(`[HorseService] Background enrichment failed for ${horse.id}:`, err.message)
    );
  }

  return horse;
};

const getHorseAnalysis = async (id: string, type: "distances" | "going" | "courses" | "classes" | "seasons") => {
  const horse = await prisma.horse.findUnique({
    where: { id },
    select: {
      distanceAnalysis: true,
      goingAnalysis: true,
      courseAnalysis: true,
      classAnalysis: true,
      seasonAnalysis: true,
    },
  });
  if (!horse) throw new Error("Horse not found");

  if (type === "distances") return horse.distanceAnalysis;
  if (type === "going") return horse.goingAnalysis;
  if (type === "courses") return horse.courseAnalysis;
  if (type === "classes") return horse.classAnalysis;
  if (type === "seasons") return horse.seasonAnalysis;
  return null;
};

export const HorseService = {
  searchHorses,
  getHorseById,
  getHorseAnalysis,
};
