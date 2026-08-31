import { CacheKey, CacheService, TTL } from "../cache/cache.service.js";
import { prisma } from "../helpers/prisma.js";
import { AlgorithmWeights, DEFAULT_WEIGHTS } from "./algorithm.types.js";

/**
 * AlgorithmSettingsService
 *
 * Load algorithm weights from the database.
 * Results are cached for TTL.ALGO_SETTINGS.
 */
export class AlgorithmSettingsService {
  static async getWeights(): Promise<AlgorithmWeights> {
    return CacheService.getOrSet<AlgorithmWeights>(
      CacheKey.algoSettings(),
      TTL.ALGO_SETTINGS,
      async () => {
        const settings = await prisma.algorithmSetting.findMany({
          where: { isActive: true },
        });

        if (settings.length === 0) {
          console.warn(
            "[AlgorithmSettings] No settings found in DB. Using defaults."
          );
          return DEFAULT_WEIGHTS;
        }

        // Merge DB values over defaults — DB always wins
        const weights: AlgorithmWeights = { ...DEFAULT_WEIGHTS };
        for (const s of settings) {
          if (s.key in weights) {
            (weights as any)[s.key] = s.value;
          }
        }

        return weights;
      }
    );
  }

  static async seedDefaults(): Promise<void> {
    const { seedAlgorithmSettings } = await import("../db/autoSeed.js");
    await seedAlgorithmSettings();
  }
}
