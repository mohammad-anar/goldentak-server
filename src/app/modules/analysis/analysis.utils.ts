import { Category } from "@prisma/client";

/**
 * HORSE POWER CALCULATION
 * Measures: Horse's own racing ability
 * Range: 0.1 - 3.0
 */
export const calculateHorsePower = (stats: {
  totalRaces: number;
  wins: number;
  seconds: number;
  thirds: number;
  fourths: number;
  lastRaceDate?: Date | null;
  recentWins: number; // Last 90 days
  recentRaces: number;
}) => {
  if (stats.totalRaces === 0) return 0.1;
  if (stats.totalRaces < 3) return 0.5;

  // STEP 1: Weighted placement score
  const PLACEMENT_WEIGHTS = { win: 3.0, second: 2.0, third: 1.5, fourth: 1.0, other: 0.3 };
  const weightedScore =
    stats.wins * PLACEMENT_WEIGHTS.win +
    stats.seconds * PLACEMENT_WEIGHTS.second +
    stats.thirds * PLACEMENT_WEIGHTS.third +
    stats.fourths * PLACEMENT_WEIGHTS.fourth +
    (stats.totalRaces - stats.wins - stats.seconds - stats.thirds - stats.fourths) * PLACEMENT_WEIGHTS.other;

  // STEP 2: Base power ratio (compared to average performer @ 1.2 pts/race)
  let basePower = weightedScore / (stats.totalRaces * 1.2);

  // STEP 3: Recency bias
  if (stats.lastRaceDate) {
    const daysSince = Math.floor((Date.now() - new Date(stats.lastRaceDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 30) basePower *= 1.15;
    else if (daysSince <= 60) basePower *= 1.05;
    else if (daysSince > 180) basePower *= 0.85;
  }

  // STEP 4: Form factor (improving vs declining)
  if (stats.recentRaces >= 3) {
    const recentWinRate = stats.recentWins / stats.recentRaces;
    const careerWinRate = stats.wins / stats.totalRaces;
    if (recentWinRate > careerWinRate * 1.5) basePower *= 1.1;
    else if (recentWinRate < careerWinRate * 0.5) basePower *= 0.9;
  }

  return Number(Math.max(0.1, Math.min(3.0, basePower)).toFixed(4));
};

/**
 * JOCKEY POWER CALCULATION
 * Measures: Jockey's recent riding skill
 */
export const calculateJockeyPower = (stats: {
  totalRides: number;
  wins: number;
  seconds: number;
  thirds: number;
  fourths: number;
  ridesLast30d: number;
  winsLast30d: number;
}) => {
  if (stats.totalRides < 10) return 1.0;

  const qualityScore = (stats.wins * 4 + stats.seconds * 3 + stats.thirds * 2 + stats.fourths * 1) / stats.totalRides;
  const normalizedQuality = qualityScore / 2.0;

  let recentFormFactor = 1.0;
  if (stats.ridesLast30d >= 5) {
    const careerWinRate = stats.wins / stats.totalRides;
    const recentWinRate = stats.winsLast30d / stats.ridesLast30d;
    const formRatio = recentWinRate / Math.max(careerWinRate, 0.05);
    recentFormFactor = Math.min(1.5, Math.max(0.6, formRatio));
  }

  let jockeyPower = normalizedQuality * recentFormFactor;
  if (stats.ridesLast30d > 20) jockeyPower *= 1.05;

  return Number(Math.max(0.2, Math.min(3.0, jockeyPower)).toFixed(4));
};

/**
 * PEDIGREE POWER (Sire/Dam/Dam-Sire)
 * Includes sample size regression and quality bonuses
 */
export const calculatePedigreeFactorPower = (stats: {
  totalRaces: number;
  wins: number;
  places: number;
  stakesWinners: number;
}, type: 'SIRE' | 'DAM' | 'DAM_SIRE') => {
  if (stats.totalRaces < (type === 'DAM' ? 5 : 20)) return 1.0;

  const winRate = stats.wins / stats.totalRaces;
  const placeRate = stats.places / stats.totalRaces;

  const AVG_WIN = type === 'SIRE' ? 0.10 : 0.09;
  const AVG_PLACE = type === 'SIRE' ? 0.35 : 0.33;

  let baseScore = (winRate / AVG_WIN) * 0.7 + (placeRate / AVG_PLACE) * 0.3;

  // Stakes winner bonus
  if (stats.stakesWinners > 0) {
    const bonus = type === 'DAM' ? 0.15 * stats.stakesWinners : 0.05;
    baseScore *= (1 + bonus);
  }

  return Number(Math.max(0.4, Math.min(type === 'DAM' ? 2.5 : 2.0, baseScore)).toFixed(4));
};

/**
 * EARNING POWER
 * Normalized earnings with race class adjustment and log scaling
 */
export const calculateEarningPower = (stats: {
  totalEarnings: number;
  totalRaces: number;
}, raceClass: string) => {
  if (stats.totalRaces === 0) return 0.1;

  const avgEarnings = stats.totalEarnings / stats.totalRaces;
  const EXPECTED_BY_CLASS: Record<string, number> = {
    'CLASS_1': 50000, 'CLASS_2': 30000, 'CLASS_3': 15000, 'HANDICAP': 10000, 'MAIDEN': 3000
  };
  const expected = EXPECTED_BY_CLASS[raceClass] || 10000;
  const ratio = avgEarnings / expected;

  // Logarithmic scaling to prevent outliers from dominating
  const earningPower = Math.log10(1 + ratio * 9);
  return Number(Math.max(0, Math.min(5.0, earningPower)).toFixed(4));
};

/**
 * WEIGHT EFFECT
 * Deviation from race average weight
 */
export const calculateWeightEffect = (horseWeight: number, avgWeight: number) => {
  const deviation = avgWeight - horseWeight;
  const IMPACT_FACTOR = 0.04;
  let effect = deviation * IMPACT_FACTOR;

  // Cap values
  return Number(Math.max(-0.5, Math.min(0.5, effect)).toFixed(4));
};

/**
 * FINAL SCORE AGGREGATION
 */
export const aggregateFinalScore = (factors: {
  horsePower: number;
  jockeyPower: number;
  fatherPower: number;
  motherPower: number;
  damSirePower: number;
  pedigreePower: number;
  earningPower: number;
  weightEffect: number;
}, weights: any) => {
  const score =
    factors.horsePower * weights.horseWeight +
    factors.jockeyPower * weights.jockeyWeight +
    factors.fatherPower * weights.fatherWeight +
    factors.motherPower * weights.motherWeight +
    factors.damSirePower * weights.damSireWeight +
    factors.pedigreePower * weights.pedigreeWeight +
    factors.earningPower * weights.earningsWeight +
    factors.weightEffect * weights.weightEffectWeight;

  return Number(score.toFixed(2));
};

/**
 * NORMALIZATION & CATEGORIZATION
 */
export const normalizeAndCategorize = (
  entries: any[],
  thresholds: { big: number; medium: number; small: number }
) => {
  if (entries.length === 0) return [];

  const scores = entries.map(e => e.rawScore);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore;

  return entries.map(entry => {
    const normalizedScore = range > 0 ? ((entry.rawScore - minScore) / range) * 200 : 100;
    const gap = 200 - normalizedScore; // Gap to leader

    let category: Category = "X";
    if (gap < thresholds.big) category = "BIG";
    else if (gap < thresholds.medium) category = "MEDIUM";
    else if (gap < thresholds.small) category = "SMALL";

    return { ...entry, normalizedScore, category };
  }).sort((a, b) => b.normalizedScore - a.normalizedScore);
};
