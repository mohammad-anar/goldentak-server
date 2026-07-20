import { prisma } from "../../../helpers/prisma.js";
import { EnrichmentService } from "../analysis/enrichment.service.js";

export class JockeyService {
  static async searchJockeys(name: string) {
    const jockeys = await prisma.jockey.findMany({
      where: { name: { contains: name, mode: "insensitive" } },
      take: 20,
    });
    return jockeys;
  }

  static async getJockeyById(id: string) {
    const jockey = await prisma.jockey.findUnique({
      where: { id },
    });
    if (!jockey) throw new Error("Jockey not found");

    // Proactively enrich if stale (older than 24 hours) or never enriched
    const isStale =
      !jockey.enrichedAt ||
      Date.now() - new Date(jockey.enrichedAt).getTime() > 24 * 60 * 60 * 1000;

    if (isStale && jockey.externalId) {
      // Trigger background enrichment silently
      EnrichmentService.enrichJockey(jockey.id, jockey.externalId).catch((err) =>
        console.error(`[JockeyService] Stale background enrichment failed for ${jockey.id}:`, err.message)
      );
    }

    return jockey;
  }

  static async getJockeyAnalysis(id: string, type: "courses" | "distances" | "trainers" | "owners") {
    const jockey = await prisma.jockey.findUnique({
      where: { id },
      select: {
        courseAnalysis: true,
        distanceAnalysis: true,
        trainerAnalysis: true,
        ownerAnalysis: true,
      },
    });
    if (!jockey) throw new Error("Jockey not found");

    if (type === "courses") return jockey.courseAnalysis;
    if (type === "distances") return jockey.distanceAnalysis;
    if (type === "trainers") return jockey.trainerAnalysis;
    if (type === "owners") return jockey.ownerAnalysis;
    return null;
  }
}
