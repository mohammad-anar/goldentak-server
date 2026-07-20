import { prisma } from "../../../helpers/prisma.js";
import { EnrichmentService } from "../analysis/enrichment.service.js";

export class OddsService {
  static async getOddsForRace(raceId: string) {
    // Check if race exists
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      select: { id: true, externalId: true },
    });
    if (!race) throw new Error("Race not found");

    const oddsList = await prisma.odds.findMany({
      where: { raceId },
      orderBy: { fetchedAt: "desc" },
    });

    return oddsList;
  }

  static async getOddsHistory(raceId: string) {
    const history = await prisma.oddsHistory.findMany({
      where: { raceId },
      orderBy: { fetchedAt: "asc" },
    });

    return history;
  }

  static async triggerManualOddsSync(raceId: string) {
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      select: { id: true, externalId: true },
    });
    if (!race) throw new Error("Race not found");
    if (!race.externalId) throw new Error("Race has no external API ID");

    const success = await EnrichmentService.syncOdds(race.id, race.externalId);
    if (!success) throw new Error("Failed to sync odds from The Racing API");

    return { success: true, message: "Odds synced successfully" };
  }
}
