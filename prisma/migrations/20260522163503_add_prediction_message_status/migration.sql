-- AlterTable
ALTER TABLE "races" ADD COLUMN     "hasPredictions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "predictionMessage" TEXT;
