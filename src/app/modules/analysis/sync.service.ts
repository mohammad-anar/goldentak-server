import { RaceStatus } from "@prisma/client";
import { prisma } from "../../../helpers/prisma.js";
import { rapidApi } from "../../config/rapid_api.js";


/**
 * Sync Upcoming Races (Racecards)
 */
const syncUpcomingRaces = async () => {
  try {
    console.log("[Sync] Fetching today's races from Rapid API...");
    const response = await rapidApi.get("/races/today");
    const races = response.data?.data || [];

    if (races.length > 0) {
      console.log("[Sync] First card sample:", JSON.stringify(races[0]).substring(0, 500));
    }

    for (const card of races) {
      // Map Rapid API fields to our Schema
      const externalId = card.id.toString();
      
      let dbStatus: RaceStatus = RaceStatus.UPCOMING;
      if (card.status === "finished") {
        dbStatus = RaceStatus.FINISHED;
      } else if (card.status === "live" || card.status === "off") {
        dbStatus = RaceStatus.LIVE;
      }

      const raceData = {
        externalId,
        name: card.race_name || "Unknown Race",
        date: new Date(card.race_date),
        time: card.off_time || "",
        location: card.racecourse_name || "Unknown Course",
        trackType: card.going || null,
        distance: card.distance || null,
        country: card.country || "United Kingdom",
        status: dbStatus,
        hasPredictions: card.has_predictions || false,
        prize: card.prize_money ? card.prize_money.toString() : null,
      };

      await prisma.race.upsert({
        where: { externalId },
        update: {
          name: raceData.name,
          date: raceData.date,
          time: raceData.time,
          location: raceData.location,
          trackType: raceData.trackType,
          distance: raceData.distance,
          country: raceData.country,
          status: raceData.status,
          hasPredictions: raceData.hasPredictions,
          prize: raceData.prize,
        },
        create: raceData,
      });
    }

    return { success: true, count: races.length };
  } catch (error: any) {
    console.error("Sync Error:", error.message);
    throw error;
  }
};

export const SyncService = {
  syncUpcomingRaces,
};
