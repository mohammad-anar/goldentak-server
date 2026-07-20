import { PedigreeRecord, RunnerContext, AlgorithmWeights } from "../algorithm.types.js";

/**
 * Shared power formula used by HorsePowerCalculator, JockeyPowerCalculator,
 * TrainerPowerCalculator, SirePowerCalculator, DamPowerCalculator, DamSirePowerCalculator.
 *
 * Power = (1st×4 + 2nd×3 + 3rd×2 + 4th×1) / TotalRuns
 * Returns 0 when TotalRuns = 0.
 */
export function computePower(
  totalRuns: number,
  wins: number,
  seconds: number,
  thirds: number,
  fourths: number
): number {
  if (totalRuns <= 0) return 0;
  const raw = (wins * 4 + seconds * 3 + thirds * 2 + fourths * 1) / totalRuns;
  return parseFloat(raw.toFixed(4));
}

export function computePedigreeRecordPower(record: PedigreeRecord | null): number {
  if (!record) return 0;
  return computePower(
    record.totalRaces,
    record.wins,
    record.seconds,
    record.thirds,
    record.fourths
  );
}

// ─── Horse Power Calculator ───────────────────────────────────────────────────
export class HorsePowerCalculator {
  static calculate(ctx: RunnerContext): number {
    const { horse } = ctx;
    return computePower(
      horse.totalRaces,
      horse.wins,
      horse.seconds,
      horse.thirds,
      horse.fourths
    );
  }
}

// ─── Jockey Power Calculator ─────────────────────────────────────────────────
export class JockeyPowerCalculator {
  static calculate(ctx: RunnerContext): number {
    const { jockey } = ctx;
    if (!jockey) return 0;
    return computePower(
      jockey.totalRides,
      jockey.wins,
      jockey.seconds,
      jockey.thirds,
      jockey.fourths
    );
  }
}

// ─── Sire Power Calculator ───────────────────────────────────────────────────
export class SirePowerCalculator {
  static calculate(ctx: RunnerContext): number {
    if (ctx.horse.sirePower != null) {
      return ctx.horse.sirePower;
    }
    return computePedigreeRecordPower(ctx.sireRecord);
  }
}

// ─── Dam Power Calculator ────────────────────────────────────────────────────
export class DamPowerCalculator {
  static calculate(ctx: RunnerContext): number {
    if (ctx.horse.damPower != null) {
      return ctx.horse.damPower;
    }
    return computePedigreeRecordPower(ctx.damRecord);
  }
}

// ─── Dam Sire Power Calculator ───────────────────────────────────────────────
export class DamSirePowerCalculator {
  static calculate(ctx: RunnerContext): number {
    if (ctx.horse.damSirePower != null) {
      return ctx.horse.damSirePower;
    }
    return computePedigreeRecordPower(ctx.damSireRecord);
  }
}

// ─── Pedigree Calculator ─────────────────────────────────────────────────────
export class PedigreeCalculator {
  static calculate(sireScore: number, damScore: number, damSireScore: number): number {
    // PedigreePower = average of Sire + Dam + DamSire powers
    return (sireScore + damScore + damSireScore) / 3;
  }
}

// ─── Horse Earnings Calculator ───────────────────────────────────────────────
export class HorseEarningsCalculator {
  static calculate(ctx: RunnerContext): number {
    const { horse, field } = ctx;
    if (horse.totalRaces === 0) return 0;
    const avgEarning = horse.totalEarnings / horse.totalRaces;
    // EarningPower = (horseAvg / fieldAvg) - 1
    if (field.fieldAvgEarning === 0) return 0;
    return avgEarning / field.fieldAvgEarning - 1;
  }
}

// ─── Horse Weight Calculator ─────────────────────────────────────────────────
export class HorseWeightCalculator {
  static calculate(ctx: RunnerContext): number {
    const { entry, field } = ctx;
    const weight = entry.weight ?? 0;
    if (field.avgWeight === 0 || weight === 0) return 0;
    // weightScore = (fieldAvg - weight) / fieldAvg
    return (field.avgWeight - weight) / field.avgWeight;
  }
}

// ─── Final Score Calculator ──────────────────────────────────────────────────
export class FinalScoreCalculator {
  static calculate(
    scores: {
      horsePower:    number;
      jockeyPower:   number;
      sirePower:     number;
      damPower:      number;
      damSirePower:  number;
      pedigreePower: number;
      earningScore:  number;
      weightScore:   number;
    },
    w: AlgorithmWeights
  ): number {
    return (
      scores.horsePower    * w.WEIGHT_HORSE    +
      scores.jockeyPower   * w.WEIGHT_JOCKEY   +
      scores.sirePower     * w.WEIGHT_SIRE     +
      scores.damPower      * w.WEIGHT_DAM      +
      scores.damSirePower  * w.WEIGHT_DAMSIRE  +
      scores.pedigreePower * w.WEIGHT_PEDIGREE +
      scores.earningScore  * w.WEIGHT_EARNING  +
      scores.weightScore   * w.WEIGHT_WEIGHT
    );
  }
}
