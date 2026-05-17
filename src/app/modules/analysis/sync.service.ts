import { PrismaClient, RaceStatus } from "@prisma/client";
import { racingApi } from "../../config/racing_api.js";
import { CalculationService } from "./calculation.service.js";

const prisma = new PrismaClient();

/**
 * Sync Upcoming Races (Racecards)
 */
const syncUpcomingRaces = async () => {
  try {
    const response = await racingApi.get("/racecards/free");
    const racecards = response.data.racecards || response.data; // The Racing API often wraps in a 'racecards' field

    if (racecards.length > 0) {
      console.log("[Sync] First card sample:", JSON.stringify(racecards[0]).substring(0, 500));
    }

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
        const horseName = runner.horse as string;
        const horseExternalId = runner.horse_id as string;

        const horse = await prisma.horse.upsert({
          where: { name: horseName },
          update: {
            externalId: horseExternalId,
            age: runner.age ? parseInt(runner.age) : undefined,
            sex: runner.sex,
            sireName: runner.sire,
            damName: runner.dam,
          },
          create: {
            name: horseName,
            externalId: horseExternalId,
            age: runner.age ? parseInt(runner.age) : undefined,
            sex: runner.sex,
            sireName: runner.sire,
            damName: runner.dam,
          },
        });

        let jockeyId: string | undefined = undefined;
        if (runner.jockey && runner.jockey_id) {
          const jockeyExternalId = runner.jockey_id as string;
          const jockeyName = runner.jockey as string;

          const jockey = await prisma.jockey.upsert({
            where: { externalId: jockeyExternalId },
            update: { name: jockeyName },
            create: {
              externalId: jockeyExternalId,
              name: jockeyName,
            },
          });
          jockeyId = jockey.id;
        }

        await prisma.raceEntry.upsert({
          where: {
            raceId_horseId: {
              raceId: race.id,
              horseId: horse.id,
            },
          },
          update: {
            jockeyName: runner.jockey,
            jockeyId,
            weight: runner.weight_lbs ? parseFloat(runner.weight_lbs) : (runner.weight_kg ? parseFloat(runner.weight_kg) : undefined),
            draw: runner.barrier ? parseInt(runner.barrier) : (runner.draw ? parseInt(runner.draw) : undefined),
          },
          create: {
            raceId: race.id,
            horseId: horse.id,
            jockeyName: runner.jockey,
            jockeyId,
            weight: runner.weight_lbs ? parseFloat(runner.weight_lbs) : (runner.weight_kg ? parseFloat(runner.weight_kg) : undefined),
            draw: runner.barrier ? parseInt(runner.barrier) : (runner.draw ? parseInt(runner.draw) : undefined),
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
