-- AlterTable
ALTER TABLE "race_entries" ADD COLUMN     "aiAnalysis" TEXT,
ADD COLUMN     "aiConfidence" TEXT,
ADD COLUMN     "aiConfidenceScore" DOUBLE PRECISION,
ADD COLUMN     "aiSelectionRank" INTEGER,
ADD COLUMN     "distanceSuitabilityScore" DOUBLE PRECISION,
ADD COLUMN     "goingSuitabilityScore" DOUBLE PRECISION,
ADD COLUMN     "jockeyFormScore" DOUBLE PRECISION,
ADD COLUMN     "placeProb" DOUBLE PRECISION,
ADD COLUMN     "trainerFormScore" DOUBLE PRECISION,
ADD COLUMN     "winOddsFair" DOUBLE PRECISION,
ADD COLUMN     "winProb" DOUBLE PRECISION;
