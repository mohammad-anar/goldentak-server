import { PredictionRankingService } from "../../../algorithm/prediction-ranking.service.js";

const calculateRaceScores = async (raceId: string) => {
  return PredictionRankingService.calculateForRace(raceId, "manual");
};

export const CalculationService = {
  calculateRaceScores,
};
