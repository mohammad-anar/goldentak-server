/*
  Warnings:

  - You are about to drop the column `planId` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the `subscription_plans` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "SubscriptionDuration" ADD VALUE 'WEEKLY';

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_planId_fkey";

-- AlterTable
ALTER TABLE "horses" ADD COLUMN     "bestTime" TEXT,
ADD COLUMN     "bestTimeLocation" TEXT,
ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "race_entries" ADD COLUMN     "courseSpecialistScore" DOUBLE PRECISION,
ADD COLUMN     "drawBiasScore" DOUBLE PRECISION,
ADD COLUMN     "eachWayProb" DOUBLE PRECISION,
ADD COLUMN     "hasValueEdge" BOOLEAN,
ADD COLUMN     "trainerName" TEXT,
ADD COLUMN     "valueEdgePercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "planId",
ALTER COLUMN "plan" SET DEFAULT 'WEEKLY';

-- DropTable
DROP TABLE "subscription_plans";

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);
