import { PrismaClient, RaceStatus } from "@prisma/client";
import { racingApi } from "../../config/racing_api.js";
import { CalculationService } from "./calculation.service.js";

const prisma = new PrismaClient();

/**
 * Sync Upcoming Races (Racecards)
 */
const syncUpcomingRaces = async () => {
  try {
    const response = await racingApi.get("/racecards");
    const racecards = response.data;

    for (const card of racecards) {
      // Map Racing API fields to our Schema
      const raceData = {
        externalId: card.race_id.toString(),
        name: card.race_name,
        date: new Date(card.date),
        time: card.off_time,
        location: card.course,
        trackType: card.going,
        distance: card.distance_f,
        status: RaceStatus.UPCOMING,
      };

      const race = await prisma.race.upsert({
        where: { externalId: raceData.externalId },
        update: raceData,
        create: raceData,
      });

      // Sync Entries for this race
      for (const runner of card.runners) {
        const horse = await prisma.horse.upsert({
          where: { name: runner.name as string } as any, // Racing API usually uses names as primary ID for simple lookups
          update: {
            age: runner.age,
            sex: runner.sex,
            sireName: runner.sire_name,
            damName: runner.dam_name,
          },
          create: {
            name: runner.name as string,
            age: runner.age,
            sex: runner.sex,
            sireName: runner.sire_name,
            damName: runner.dam_name,
          },
        });

        await prisma.raceEntry.upsert({
          where: {
            raceId_horseId: {
              raceId: race.id,
              horseId: horse.id,
            },
          },
          update: {
            jockeyName: runner.jockey_name,
            weight: runner.weight_lbs,
            draw: runner.draw,
          },
          create: {
            raceId: race.id,
            horseId: horse.id,
            jockeyName: runner.jockey_name,
            weight: runner.weight_lbs,
            draw: runner.draw,
          },
        });
      }

      // Trigger automatic calculation for this race
      await CalculationService.calculateRaceScores(race.id);
    }

    return { success: true, count: racecards.length };
  } catch (error: any) {
    console.error("Sync Error:", error.message);
    throw error;
  }
};

export const SyncService = {
  syncUpcomingRaces,
};
