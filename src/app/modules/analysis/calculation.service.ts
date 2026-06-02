import { prisma } from "../../../helpers/prisma.js";
import { rapidApi } from "../../config/rapid_api.js";


function parseWeight(weightStr: string | null | undefined): number {
  if (!weightStr) return 0;
  
  const numeric = Number(weightStr);
  if (!isNaN(numeric)) return numeric;

  const parts = weightStr.split("-");
  if (parts.length === 2) {
    const stones = parseInt(parts[0], 10);
    const lbs = parseInt(parts[1], 10);
    if (!isNaN(stones) && !isNaN(lbs)) {
      return stones * 14 + lbs;
    }
  }

  const parsed = parseFloat(weightStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Main service to calculate scores for a specific race
 */
const calculateRaceScores = async (raceId: string) => {
  console.log(`[Calc] Starting analysis for race: ${raceId}`);

  // 2. Fetch Race
  const race = await prisma.race.findUnique({
    where: { id: raceId }
  });

  if (!race) throw new Error("Race not found");

  // 3. Fetch race details (with runners/entries) from Rapid API
  console.log(`[Calc] Fetching race details from Rapid API for external ID: ${race.externalId}`);
  const detailsResponse = await rapidApi.get(`/races/${race.externalId}`);
  const apiRace = detailsResponse.data?.data;
  
  if (!apiRace) {
    throw new Error(`Failed to fetch race details from Rapid API for ID ${race.externalId}`);
  }

  const apiEntries = apiRace.entries || [];
  console.log(`[Calc] Synced details. Found ${apiEntries.length} entries.`);

  // 4. Upsert Horses, Jockeys, and Race Entries
  for (const entry of apiEntries) {
    // Upsert Horse
    let horse = await prisma.horse.findUnique({
      where: { name: entry.horse_name }
    });

    if (!horse) {
      horse = await prisma.horse.create({
        data: {
          externalId: entry.horse_id?.toString() || null,
          name: entry.horse_name,
          age: entry.horse_age || null,
          sex: entry.horse_sex || null,
          sireName: entry.sire || null,
          damName: entry.dam || null,
        }
      });
    } else if (entry.horse_id && !horse.externalId) {
      horse = await prisma.horse.update({
        where: { id: horse.id },
        data: { externalId: entry.horse_id.toString() }
      });
    }

    // Upsert Jockey
    let jockey = null;
    if (entry.jockey_name) {
      jockey = await prisma.jockey.findFirst({
        where: { name: entry.jockey_name }
      });

      if (!jockey) {
        jockey = await prisma.jockey.create({
          data: {
            externalId: entry.jockey_id?.toString() || null,
            name: entry.jockey_name,
          }
        });
      } else if (entry.jockey_id && !jockey.externalId) {
        jockey = await prisma.jockey.update({
          where: { id: jockey.id },
          data: { externalId: entry.jockey_id.toString() }
        });
      }
    }

    // Upsert RaceEntry
    const parsedWeight = parseWeight(entry.weight);
    await prisma.raceEntry.upsert({
      where: {
        raceId_horseId: {
          raceId: race.id,
          horseId: horse.id,
        }
      },
      update: {
        jockeyId: jockey?.id || null,
        jockeyName: entry.jockey_name || null,
        weight: parsedWeight,
        draw: entry.draw || null,
      },
      create: {
        raceId: race.id,
        horseId: horse.id,
        jockeyId: jockey?.id || null,
        jockeyName: entry.jockey_name || null,
        weight: parsedWeight,
        draw: entry.draw || null,
      }
    });

    // Upsert RaceResult if finish position exists
    if (entry.finish_position !== null && entry.finish_position !== undefined) {
      const pos = parseInt(entry.finish_position, 10);
      if (!isNaN(pos)) {
        await prisma.raceResult.upsert({
          where: {
            raceId_horseId: {
              raceId: race.id,
              horseId: horse.id,
            }
          },
          update: {
            position: pos,
            time: apiRace.winning_time || null,
          },
          create: {
            raceId: race.id,
            horseId: horse.id,
            jockeyId: jockey?.id || null,
            position: pos,
            time: apiRace.winning_time || null,
          }
        });

        // Update Horse career statistics based on all results in DB
        const horseResults = await prisma.raceResult.findMany({ where: { horseId: horse.id } });
        const wins = horseResults.filter(r => r.position === 1).length;
        const seconds = horseResults.filter(r => r.position === 2).length;
        const thirds = horseResults.filter(r => r.position === 3).length;
        const fourths = horseResults.filter(r => r.position === 4).length;
        const totalRaces = horseResults.length;

        await prisma.horse.update({
          where: { id: horse.id },
          data: { wins, seconds, thirds, fourths, totalRaces }
        });

        // Also update Jockey career stats if jockey is present
        if (jockey) {
          const jockeyResults = await prisma.raceResult.findMany({ where: { jockeyId: jockey.id } });
          const jWins = jockeyResults.filter(r => r.position === 1).length;
          const jSeconds = jockeyResults.filter(r => r.position === 2).length;
          const jThirds = jockeyResults.filter(r => r.position === 3).length;
          const jFourths = jockeyResults.filter(r => r.position === 4).length;
          const totalRides = jockeyResults.length;

          await prisma.jockey.update({
            where: { id: jockey.id },
            data: { wins: jWins, seconds: jSeconds, thirds: jThirds, fourths: jFourths, totalRides }
          });
        }
      }
    }
  }

  // 5. Fetch predictions from Rapid API
  console.log(`[Calc] Fetching predictions from Rapid API for external ID: ${race.externalId}`);
  const predictionsResponse = await rapidApi.get(`/predictions/race/${race.externalId}`);
  const predData = predictionsResponse.data;

  // Handle pending prediction status
  if (predData.status === "pending") {
    const pendingMsg = predData.message || "Predictions for this race are currently pending.";
    console.log(`[Calc] Predictions pending: ${pendingMsg}`);
    
    await prisma.race.update({
      where: { id: race.id },
      data: {
        predictionMessage: pendingMsg,
        hasPredictions: false
      }
    });

    throw new Error(pendingMsg);
  }

  // Update race prediction status in DB
  await prisma.race.update({
    where: { id: race.id },
    data: {
      predictionMessage: null,
      hasPredictions: true
    }
  });

  const apiPredictions = predData.predictions || [];
  console.log(`[Calc] Predictions fetched. Found ${apiPredictions.length} predictions.`);

  // 6. Fetch all database entries for calculating
  const dbEntries = await prisma.raceEntry.findMany({
    where: { raceId: race.id },
    include: {
      horse: true,
      jockey: true,
    }
  });

  const results = [];

  for (const entry of dbEntries) {
    const { horse, jockey } = entry;

    // Find the corresponding prediction record from Rapid API
    const predItem = apiPredictions.find((p: any) => 
      (p.horse_id && horse.externalId && p.horse_id.toString() === horse.externalId) ||
      (p.horse_name && p.horse_name.toLowerCase() === horse.name.toLowerCase())
    );

    let goingScore = 0.5;
    let distScore = 0.5;
    let trainScore = 0.5;
    let jFormScore = 0.5;

    // AI Prediction Details to store
    let aiFields: any = {
      winProb: null,
      winOddsFair: null,
      placeProb: null,
      goingSuitabilityScore: null,
      distanceSuitabilityScore: null,
      jockeyFormScore: null,
      trainerFormScore: null,
      aiSelectionRank: null,
      aiConfidence: null,
      aiConfidenceScore: null,
      aiAnalysis: null,
    };

    if (predItem) {
      goingScore = predItem.going_suitability?.score ?? 0.5;
      distScore = predItem.distance_suitability?.score ?? 0.5;
      trainScore = predItem.trainer_form?.score ?? 0.5;
      jFormScore = predItem.jockey_form?.score ?? 0.5;

      aiFields = {
        winProb: predItem.win?.win_prob ?? null,
        winOddsFair: predItem.win?.win_odds_fair ?? null,
        placeProb: predItem.place?.place_prob ?? null,
        goingSuitabilityScore: goingScore,
        distanceSuitabilityScore: distScore,
        jockeyFormScore: jFormScore,
        trainerFormScore: trainScore,
        aiSelectionRank: predItem.selection_rank ?? null,
        aiConfidence: predItem.confidence ?? null,
        aiConfidenceScore: predItem.confidence_score ?? null,
        aiAnalysis: predItem.analysis ?? null,
      };

      // Update Jockey recent form in DB
      if (jockey && predItem.jockey_form) {
        await prisma.jockey.update({
          where: { id: jockey.id },
          data: {
            winsLast30d: predItem.jockey_form.recent_wins || 0,
            ridesLast30d: predItem.jockey_form.recent_runs || 0,
          }
        });
      }
    }

    // Synthetic horse power: map average going, distance, trainer scores (0.0 to 1.0) to (0.1 to 3.0)
    const avgHorseScore = (goingScore + distScore + trainScore) / 3;
    const horsePower = Number((0.1 + avgHorseScore * 2.9).toFixed(4));

    // Synthetic jockey power: map jockey form score (0.0 to 1.0) to (0.2 to 3.0)
    const jockeyPower = Number((0.2 + jFormScore * 2.8).toFixed(4));

    // Normalized score is win probability * 100
    const normalizedScore = aiFields.winProb !== null ? Number((aiFields.winProb * 100).toFixed(2)) : 0;

    // Map AI confidence to category
    let category = null;
    if (aiFields.aiConfidence) {
      const confUpper = aiFields.aiConfidence.toUpperCase();
      if (confUpper === "HIGH") category = "BIG";
      else if (confUpper === "MEDIUM") category = "MEDIUM";
      else if (confUpper === "LOW") category = "SMALL";
    }

    results.push({
      id: entry.id,
      horsePower,
      jockeyPower,
      normalizedScore,
      category,
      aiSelectionRank: aiFields.aiSelectionRank,
      ...aiFields,
    });
  }

  // Determine ranks based on aiSelectionRank or winProb descending
  results.sort((a, b) => {
    if (a.aiSelectionRank !== null && b.aiSelectionRank !== null) {
      return a.aiSelectionRank - b.aiSelectionRank;
    }
    if (a.aiSelectionRank !== null) return -1;
    if (b.aiSelectionRank !== null) return 1;
    return b.normalizedScore - a.normalizedScore;
  });

  // 7. Update Database with final results and raw AI predictions
  for (let i = 0; i < results.length; i++) {
    const p = results[i];
    const rank = p.aiSelectionRank !== null ? p.aiSelectionRank : (i + 1);

    await prisma.raceEntry.update({
      where: { id: p.id },
      data: {
        horsePower: p.horsePower,
        jockeyPower: p.jockeyPower,
        normalizedScore: p.normalizedScore,
        category: p.category,
        rank: rank,
        
        // AI fields
        winProb: p.winProb,
        winOddsFair: p.winOddsFair,
        placeProb: p.placeProb,
        goingSuitabilityScore: p.goingSuitabilityScore,
        distanceSuitabilityScore: p.distanceSuitabilityScore,
        jockeyFormScore: p.jockeyFormScore,
        trainerFormScore: p.trainerFormScore,
        aiSelectionRank: p.aiSelectionRank,
        aiConfidence: p.aiConfidence,
        aiConfidenceScore: p.aiConfidenceScore,
        aiAnalysis: p.aiAnalysis,
      }
    });
  }

  // Return the processed results sorted by rank
  return await prisma.raceEntry.findMany({
    where: { raceId: race.id },
    include: {
      horse: true,
      jockey: true,
    },
    orderBy: { rank: 'asc' }
  });
};

export const CalculationService = {
  calculateRaceScores,
};
