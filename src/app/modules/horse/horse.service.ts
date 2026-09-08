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
    select: {
      id: true,
      externalId: true,
      name: true,
      age: true,
      colour: true,
      sex: true,
      sireName: true,
      damName: true,
      damSireName: true,
      owner: true,
      trainer: true,
      country: true,
      totalEarnings: true,
      bestTime: true,
      bestTimeLocation: true,
      totalRaces: true,
      wins: true,
      seconds: true,
      thirds: true,
      fourths: true,
      enrichedAt: true,
      results: {
        select: {
          id: true,
          position: true,
          time: true,
          earnings: true,
          btn: true,
          ovrBtn: true,
          or: true,
          rpr: true,
          race: {
            select: {
              id: true,
              name: true,
              date: true,
              location: true,
              country: true,
              trackType: true,
              surface: true,
              distance: true,
            },
          },
        },
        orderBy: { race: { date: "desc" } },
        take: 20,
      },
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
