import { PrismaClient } from "@prisma/client";
import * as Utils from "./analysis.utils.js";
import { SystemSettingsService } from "../system/system.settings.service.js";

const prisma = new PrismaClient();

/**
 * Main service to calculate scores for a specific race
 */
const calculateRaceScores = async (raceId: string) => {
  console.log(`[Calc] Starting analysis for race: ${raceId}`);

  // 1. Fetch Algorithm Settings
  const settings = await SystemSettingsService.getAlgorithmSettings();

  // 2. Fetch Race and its Entries with full stats
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: {
      entries: {
        include: {
          horse: true,
          jockey: true,
        }
      }
    }
  });

  if (!race) throw new Error("Race not found");

  const entries = race.entries;
  if (entries.length === 0) return [];

  // 3. Calculate Average Weight for the race
  const weights = entries.map(e => e.weight || 0).filter(w => w > 0);
  const avgWeight = weights.length > 0 
    ? weights.reduce((a, b) => a + b, 0) / weights.length 
    : 0;

  // 4. Calculate Individual Power Scores
  const results = [];
  for (const entry of entries) {
    const { horse, jockey } = entry;

    // Power Metrics
    const horsePower = Utils.calculateHorsePower({
      totalRaces: horse.totalRaces,
      wins: horse.wins,
      seconds: horse.seconds,
      thirds: horse.thirds,
      fourths: horse.fourths,
      lastRaceDate: horse.lastRaceDate,
      recentWins: 0, // Need to implement recent stats tracking
      recentRaces: 0,
    });

    const jockeyPower = Utils.calculateJockeyPower({
      totalRides: jockey?.totalRides || 0,
      wins: jockey?.wins || 0,
      seconds: jockey?.seconds || 0,
      thirds: jockey?.thirds || 0,
      fourths: jockey?.fourths || 0,
      ridesLast30d: jockey?.ridesLast30d || 0,
      winsLast30d: jockey?.winsLast30d || 0,
    });

    const fatherPower = Utils.calculatePedigreeFactorPower({
      totalRaces: 100, // Placeholder for aggregation logic
      wins: horse.sireWinRate ? horse.sireWinRate * 100 : 10,
      places: horse.sirePlaceRate ? horse.sirePlaceRate * 100 : 35,
      stakesWinners: 1
    }, 'SIRE');

    const motherPower = Utils.calculatePedigreeFactorPower({
      totalRaces: 50,
      wins: horse.damWinRate ? horse.damWinRate * 50 : 5,
      places: horse.damPlaceRate ? horse.damPlaceRate * 50 : 15,
      stakesWinners: 0
    }, 'DAM');

    const damSirePower = Utils.calculatePedigreeFactorPower({
      totalRaces: 100,
      wins: horse.damSireWinRate ? horse.damSireWinRate * 100 : 10,
      places: horse.damSirePlaceRate ? horse.damSirePlaceRate * 100 : 35,
      stakesWinners: 0
    }, 'DAM_SIRE');

    const pedigreePower = Number(((fatherPower * 0.5) + (motherPower * 0.3) + (damSirePower * 0.2)).toFixed(4));
    
    const earningPower = Utils.calculateEarningPower({
      totalEarnings: horse.totalEarnings,
      totalRaces: horse.totalRaces
    }, race.trackType || 'HANDICAP');

    const weightEffect = Utils.calculateWeightEffect(entry.weight || 0, avgWeight);

    // Final Aggregate Raw Score
    const rawScore = Utils.aggregateFinalScore({
      horsePower,
      jockeyPower,
      fatherPower,
      motherPower,
      damSirePower,
      pedigreePower,
      earningPower,
      weightEffect
    }, settings);

    results.push({
      id: entry.id,
      horsePower,
      jockeyPower,
      fatherPower,
      motherPower,
      damSirePower,
      pedigreePower,
      earningPower,
      weightEffect,
      rawScore
    });
  }

  // 5. Normalize and Categorize
  const processed = Utils.normalizeAndCategorize(results, {
    big: settings.bigThreshold,
    medium: settings.mediumThreshold,
    small: settings.smallThreshold
  });

  // 6. Update Database
  for (const p of processed) {
    await prisma.raceEntry.update({
      where: { id: p.id },
      data: {
        horsePower: p.horsePower,
        jockeyPower: p.jockeyPower,
        fatherPower: p.fatherPower,
        motherPower: p.motherPower,
        damSirePower: p.damSirePower,
        pedigreePower: p.pedigreePower,
        earningPower: p.earningPower,
        weightEffect: p.weightEffect,
        rawScore: p.rawScore,
        normalizedScore: p.normalizedScore,
        category: p.category,
        rank: processed.findIndex(x => x.id === p.id) + 1
      }
    });
  }

  return processed;
};

export const CalculationService = {
  calculateRaceScores,
};
