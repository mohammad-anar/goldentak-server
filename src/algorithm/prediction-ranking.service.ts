// prediction-ranking.service.ts
// Responsibility: run calculators, persist scores to PostgreSQL.
import { prisma } from "../helpers/prisma.js";
import { AlgorithmSettingsService } from "./algorithm-settings.service.js";
import {
  HorsePowerCalculator,
  JockeyPowerCalculator,
  SirePowerCalculator,
  DamPowerCalculator,
  DamSirePowerCalculator,
  PedigreeCalculator,
  HorseEarningsCalculator,
  HorseWeightCalculator,
  FinalScoreCalculator,
} from "./calculators/index.js";
import { PedigreeRecord, RankedRunner, RunnerContext, ScoreBreakdown, AlgorithmWeights } from "./algorithm.types.js";
import { pushRaceUpdate } from "../helpers/sseHelper.js";
import { clearRaceCache } from "../helpers/redis.js";
import { NotificationService } from "../app/modules/notification/notification.service.js";
import { NotificationType } from "@prisma/client";

function classifyCategory(
  rank: number,
  rawScore: number,
  topRawScore: number,
  weights: AlgorithmWeights
): "MINIMUM" | "SMALL" | "MEDIUM" | "LARGE" | "MEGA" {
  if (rank === 1) return "MINIMUM";
  const diff = topRawScore - rawScore;

  if (diff <= weights.THRESH_MINIMUM) return "MINIMUM";
  if (diff <= weights.THRESH_SMALL) return "SMALL";
  if (diff <= weights.THRESH_MEDIUM) return "MEDIUM";
  if (diff <= weights.THRESH_LARGE) return "LARGE";
  return "MEGA";
}

export class PredictionRankingService {
  static async calculateForRace(
    raceId: string,
    triggeredBy: "cron" | "manual" | "worker" = "worker"
  ): Promise<RankedRunner[]> {
    const startedAt = Date.now();
    console.log(`[Algorithm] Starting prediction for race: ${raceId}`);

    // 1. Load race with all runner data
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: {
        entries: {
          include: {
            horse:   true,
            jockey:  true,
            trainer: true,
          },
        },
      },
    });

    if (!race) throw new Error(`Race ${raceId} not found`);
    if (race.entries.length === 0) {
      throw new Error(`No entries found for race ${raceId}`);
    }

    // 2. Load weights from DB (cached)
    const weights = await AlgorithmSettingsService.getWeights();

    // 3. Pre-compute field-wide values needed for normalisation
    const weights_ = race.entries.map((e: any) => e.weight ?? 0).filter((w: number) => w > 0);
    const avgWeight = weights_.length > 0
      ? weights_.reduce((a: number, b: number) => a + b, 0) / weights_.length
      : 0;

    const earningsPerRace = race.entries.map((e: any) => {
      const avg = e.horse.totalRaces > 0 ? e.horse.totalEarnings / e.horse.totalRaces : 0;
      return { entryId: e.id, avg };
    });
    const fieldAvgEarning = earningsPerRace.length > 0
      ? earningsPerRace.reduce((s: number, x: any) => s + x.avg, 0) / earningsPerRace.length
      : 0;

    // 4. Create algorithm run log
    const algorithmRun = await prisma.algorithmRun.create({
      data: {
        raceId,
        triggeredBy,
        status: "RUNNING",
        startedAt: new Date(startedAt),
        runnersProcessed: 0,
      },
    });

    const runnerScores: Array<{
      entryId:   string;
      horseName: string;
      scores:    ScoreBreakdown;
      rawScore:  number;
    }> = [];

    try {
      // 5. Score each runner
      for (const entry of race.entries) {
        const horse   = entry.horse;
        const jockey  = entry.jockey;
        const trainer = entry.trainer;

        // Fetch pedigree records from DB (as fallbacks if horse relations are not enriched)
        let sireRecord: PedigreeRecord | null = null;
        let damRecord: PedigreeRecord | null = null;
        let damSireRecord: PedigreeRecord | null = null;

        if (horse.sireModelId) {
          const s = await prisma.sire.findUnique({ where: { id: horse.sireModelId } });
          if (s) {
            sireRecord = {
              totalRaces: s.totalOffspring,
              wins:       s.wins,
              seconds:    s.seconds,
              thirds:     s.thirds,
              fourths:    s.fourths,
            };
          }
        } else if (horse.sireName) {
          const s = await prisma.horse.findFirst({
            where: { name: { equals: horse.sireName, mode: "insensitive" } },
            select: { totalRaces: true, wins: true, seconds: true, thirds: true, fourths: true },
          });
          if (s) sireRecord = s;
        }

        if (horse.damModelId) {
          const d = await prisma.dam.findUnique({ where: { id: horse.damModelId } });
          if (d) {
            damRecord = {
              totalRaces: d.totalProgeny,
              wins:       d.wins,
              seconds:    d.seconds,
              thirds:     d.thirds,
              fourths:    d.fourths,
            };
          }
        } else if (horse.damName) {
          const d = await prisma.horse.findFirst({
            where: { name: { equals: horse.damName, mode: "insensitive" } },
            select: { totalRaces: true, wins: true, seconds: true, thirds: true, fourths: true },
          });
          if (d) damRecord = d;
        }

        if (horse.damSireModelId) {
          const ds = await prisma.damSire.findUnique({ where: { id: horse.damSireModelId } });
          if (ds) {
            damSireRecord = {
              totalRaces: ds.totalOffspring,
              wins:       ds.wins,
              seconds:    ds.seconds,
              thirds:     ds.thirds,
              fourths:    ds.fourths,
            };
          }
        } else if (horse.damSireName) {
          const ds = await prisma.horse.findFirst({
            where: { name: { equals: horse.damSireName, mode: "insensitive" } },
            select: { totalRaces: true, wins: true, seconds: true, thirds: true, fourths: true },
          });
          if (ds) damSireRecord = ds;
        }

        const ctx: RunnerContext = {
          entry: {
            id:              entry.id,
            weight:          entry.weight,
            draw:            entry.draw,
            lastRun:         entry.lastRun,
            form:            entry.form,
            rpr:             entry.rpr,
            ts:              entry.ts,
            ofr:             entry.ofr,
            speedRating:     entry.speedRating,
            trainerLocation: entry.trainerLocation,
          },
          horse: {
            id:              horse.id,
            name:            horse.name,
            totalRaces:      horse.totalRaces,
            wins:            horse.wins,
            seconds:         horse.seconds,
            thirds:          horse.thirds,
            fourths:         horse.fourths,
            totalEarnings:   horse.totalEarnings,
            runsLast30d:     horse.runsLast30d,
            winsLast30d:     horse.winsLast30d,
            runsLast90d:     horse.runsLast90d,
            winsLast90d:     horse.winsLast90d,
            sirePower:       horse.sirePower,
            sirePlaceRate:   horse.sirePlaceRate,
            damPower:        horse.damPower,
            damPlaceRate:    horse.damPlaceRate,
            damSirePower:    horse.damSirePower,
            damSirePlaceRate:horse.damSirePlaceRate,
            sireName:        horse.sireName,
            damName:         horse.damName,
            damSireName:     horse.damSireName,
            lastRaceDate:    horse.lastRaceDate,
          },
          jockey:  jockey  ? { id: jockey.id,  name: jockey.name,  totalRides: jockey.totalRides, wins: jockey.wins, seconds: jockey.seconds, thirds: jockey.thirds, fourths: jockey.fourths, winsLast30d: jockey.winsLast30d, ridesLast30d: jockey.ridesLast30d } : null,
          trainer: trainer ? { id: trainer.id, name: trainer.name, totalRuns: trainer.totalRuns, wins: trainer.wins, seconds: trainer.seconds, thirds: trainer.thirds, fourths: trainer.fourths, winsLast30d: trainer.winsLast30d, runsLast30d: trainer.runsLast30d } : null,
          sireRecord,
          damRecord,
          damSireRecord,
          field: {
            avgWeight,
            fieldAvgEarning,
            location: race.location,
            distance: race.distance,
            surface:  race.surface,
            going:    race.goingDetailed,
          },
        };

        // ── Run calculators ──────────────────────────────────────────────────
        const horsePower    = HorsePowerCalculator.calculate(ctx);
        const jockeyPower   = JockeyPowerCalculator.calculate(ctx);
        const sirePower     = SirePowerCalculator.calculate(ctx);
        const damPower      = DamPowerCalculator.calculate(ctx);
        const damSirePower  = DamSirePowerCalculator.calculate(ctx);
        const pedigreePower = PedigreeCalculator.calculate(sirePower, damPower, damSirePower);
        const earningScore  = HorseEarningsCalculator.calculate(ctx);
        const weightScore   = HorseWeightCalculator.calculate(ctx);

        const scores: ScoreBreakdown = {
          horsePower,
          jockeyPower,
          sirePower,
          damPower,
          damSirePower,
          pedigreePower,
          earningScore,
          weightScore,

          // Weighted component scores
          horseScore:           horsePower    * weights.WEIGHT_HORSE,
          jockeyScore:          jockeyPower   * weights.WEIGHT_JOCKEY,
          sireScore:            sirePower     * weights.WEIGHT_SIRE,
          damScore:             damPower      * weights.WEIGHT_DAM,
          damSireScore:         damSirePower  * weights.WEIGHT_DAMSIRE,
          pedigreeScore:        pedigreePower * weights.WEIGHT_PEDIGREE,
          earningScoreWeighted: earningScore  * weights.WEIGHT_EARNING,
          weightScoreWeighted:  weightScore   * weights.WEIGHT_WEIGHT,
          rawScore:             0,
        };

        const rawScore = FinalScoreCalculator.calculate(scores as any, weights);
        scores.rawScore = rawScore;

        runnerScores.push({ entryId: entry.id, horseName: horse.name, scores, rawScore });
      }

      // 6. Sort by raw score descending, assign ranks & categories
      runnerScores.sort((a, b) => b.rawScore - a.rawScore);
      const topScore = runnerScores[0]?.rawScore ?? 0;

      const ranked: RankedRunner[] = [];

      for (let i = 0; i < runnerScores.length; i++) {
        const { entryId, horseName, scores, rawScore } = runnerScores[i];
        const rank     = i + 1;
        const category = classifyCategory(rank, rawScore, topScore, weights);
        
        // Single 100% benchmark: Rank 1 strictly receives 100%. All others scale proportionally downwards.
        // Guarantee no second horse ever receives 100%.
        let normalizedScore = 0.0;
        if (rank === 1) {
          normalizedScore = 100.0;
        } else if (topScore > 0) {
          const proportional = (rawScore / topScore) * 100.0;
          normalizedScore = Number(Math.min(99.0, Math.max(0.0, proportional)).toFixed(1));
        }

        // Persist final values to race_entries
        await prisma.raceEntry.update({
          where: { id: entryId },
          data: {
            horsePower:    scores.horsePower,
            jockeyPower:   scores.jockeyPower,
            sirePower:     scores.sirePower,
            damPower:      scores.damPower,
            damSirePower:  scores.damSirePower,
            pedigreePower: scores.pedigreePower,
            earningScore:  scores.earningScore,
            weightScore:   scores.weightScore,
            rawScore,
            normalizedScore,
            rank,
            category:      category as any,
          },
        });

        // Persist score log
        await prisma.predictionScoreLog.create({
          data: {
            algorithmRunId:  algorithmRun.id,
            raceEntryId:     entryId,
            horseName,
            horsePower:      scores.horsePower,
            jockeyPower:     scores.jockeyPower,
            sirePower:       scores.sirePower,
            damPower:        scores.damPower,
            damSirePower:    scores.damSirePower,
            pedigreePower:   scores.pedigreePower,
            earningPower:    scores.earningScore,
            weightEffect:    scores.weightScore,
            horseScore:      scores.horseScore,
            jockeyScore:     scores.jockeyScore,
            sireScore:       scores.sireScore,
            damScore:        scores.damScore,
            damSireScore:    scores.damSireScore,
            pedigreeScore:   scores.pedigreeScore,
            earningScore:    scores.earningScoreWeighted,
            weightScore:     scores.weightScoreWeighted,
            rawScore,
            normalizedScore,
            rank,
            category,
            diffFromTop:     topScore - rawScore,
          },
        });

        ranked.push({ entryId, horseName, rank, category, scores, normalizedScore });
      }

      // 7. Update race-level prediction summary
      const topResult   = runnerScores[0];
      let tahmin1X      = "12";
      let riskRate      = 45;

      if (topResult) {
        if (topResult.rawScore >= 120) {
          tahmin1X = "1"; riskRate = 85;
        } else if (topResult.rawScore >= 70) {
          tahmin1X = "1X"; riskRate = 65;
        }
      }

      // Collect all top picks in the SMALL category
      const topCats = runnerScores
        .filter((r) => topScore - r.rawScore <= weights.THRESH_SMALL)
        .map((r) => r.horseName);

      const predictionMessage = topResult
        ? `${topCats.join(" & ")} ${topCats.length > 1 ? "are" : "is"} the top pick${topCats.length > 1 ? "s" : ""} (score: ${topResult.rawScore.toFixed(2)}).`
        : "No prediction available.";

      await prisma.race.update({
        where: { id: raceId },
        data: { tahmin1X, riskRate, predictionMessage, hasPredictions: true, predictedAt: new Date() },
      });

      // 8. Finalise algorithm run log
      const durationMs = Date.now() - startedAt;
      await prisma.algorithmRun.update({
        where: { id: algorithmRun.id },
        data: {
          status:           "SUCCESS",
          completedAt:      new Date(),
          durationMs,
          runnersProcessed: ranked.length,
        },
      });

      // 9. Send notifications + push SSE update
      if (ranked.length > 0) {
        await NotificationService.sendRaceNotification(raceId, NotificationType.PREDICTION_READY);
      }

      const finalEntries = await prisma.raceEntry.findMany({
        where:   { raceId },
        include: { horse: true, jockey: true },
        orderBy: { rank: "asc" },
      });

      const updatedRace = await prisma.race.findUnique({ where: { id: raceId } });
      if (updatedRace) {
        pushRaceUpdate(raceId, { ...updatedRace, entries: finalEntries });
      }

      await clearRaceCache(raceId);

      console.log(`[Algorithm] Completed in ${durationMs}ms — ${ranked.length} runners ranked.`);
      return ranked;

    } catch (err: any) {
      await prisma.algorithmRun.update({
        where: { id: algorithmRun.id },
        data: {
          status:      "FAILED",
          completedAt: new Date(),
          durationMs:  Date.now() - startedAt,
          error:       err.message,
        },
      });
      throw err;
    }
  }
}
