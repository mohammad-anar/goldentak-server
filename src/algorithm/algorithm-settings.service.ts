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
    const defaultSettings: Array<{
      key: keyof AlgorithmWeights;
      value: number;
      label: string;
      description: string;
      category: string;
    }> = [
      { key: "WEIGHT_HORSE",    value: 45,   label: "Horse Power Weight",       description: "Multiplier for horsePower component", category: "horse" },
      { key: "WEIGHT_JOCKEY",   value: 35,   label: "Jockey Power Weight",      description: "Multiplier for jockeyPower component", category: "jockey" },
      { key: "WEIGHT_SIRE",     value: 8,    label: "Sire Power Weight",        description: "Multiplier for sire offspring stats", category: "sire" },
      { key: "WEIGHT_DAM",      value: 6,    label: "Dam Power Weight",         description: "Multiplier for dam progeny stats", category: "dam" },
      { key: "WEIGHT_DAMSIRE",  value: 2,    label: "Dam Sire Power Weight",    description: "Multiplier for maternal grandsire stats", category: "damsire" },
      { key: "WEIGHT_PEDIGREE", value: 5,    label: "Pedigree Average Weight",  description: "Multiplier for pedigree power average", category: "pedigree" },
      { key: "WEIGHT_EARNING",  value: 5,    label: "Earning Power Weight",     description: "Multiplier for earning score", category: "earning" },
      { key: "WEIGHT_WEIGHT",   value: 10,   label: "Weight Effect Multiplier", description: "Multiplier for weight effect score", category: "weight" },
      { key: "THRESH_SMALL",    value: 20,   label: "SMALL Category Threshold", description: "Diff from top score <= 20 -> SMALL", category: "threshold" },
      { key: "THRESH_MEDIUM",   value: 50,   label: "MEDIUM Category Threshold",description: "Diff from top score <= 50 -> MEDIUM", category: "threshold" },
      { key: "THRESH_BIG",      value: 57,   label: "BIG Category Threshold",   description: "Diff from top score <= 57 -> BIG", category: "threshold" },
    ];

    for (const s of defaultSettings) {
      await prisma.algorithmSetting.upsert({
        where: { key: s.key },
        update: {},
        create: {
          key: s.key,
          value: s.value,
          label: s.label,
          description: s.description,
          category: s.category,
        },
      });
    }

    console.log("[AlgorithmSettings] Default weights seeded.");
  }
}
