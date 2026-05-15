/*
  Warnings:

  - You are about to drop the column `damSirePower` on the `horses` table. All the data in the column will be lost.
  - You are about to drop the column `fatherPower` on the `horses` table. All the data in the column will be lost.
  - You are about to drop the column `horsePower` on the `horses` table. All the data in the column will be lost.
  - You are about to drop the column `motherPower` on the `horses` table. All the data in the column will be lost.
  - You are about to drop the column `pedigreePower` on the `horses` table. All the data in the column will be lost.
  - You are about to drop the column `powerScore` on the `jockeys` table. All the data in the column will be lost.
  - You are about to drop the column `finalScore` on the `race_entries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "horses" DROP COLUMN "damSirePower",
DROP COLUMN "fatherPower",
DROP COLUMN "horsePower",
DROP COLUMN "motherPower",
DROP COLUMN "pedigreePower",
ADD COLUMN     "damPlaceRate" DOUBLE PRECISION,
ADD COLUMN     "damSirePlaceRate" DOUBLE PRECISION,
ADD COLUMN     "damSireWinRate" DOUBLE PRECISION,
ADD COLUMN     "damWinRate" DOUBLE PRECISION,
ADD COLUMN     "fourths" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastRaceDate" TIMESTAMP(3),
ADD COLUMN     "seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sirePlaceRate" DOUBLE PRECISION,
ADD COLUMN     "sireWinRate" DOUBLE PRECISION,
ADD COLUMN     "thirds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalRaces" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "jockeys" DROP COLUMN "powerScore",
ADD COLUMN     "fourths" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ridesLast30d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thirds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalRides" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "winsLast30d" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "race_entries" DROP COLUMN "finalScore",
ADD COLUMN     "damSirePower" DOUBLE PRECISION,
ADD COLUMN     "earningPower" DOUBLE PRECISION,
ADD COLUMN     "fatherPower" DOUBLE PRECISION,
ADD COLUMN     "jockeyName" TEXT,
ADD COLUMN     "motherPower" DOUBLE PRECISION,
ADD COLUMN     "normalizedScore" DOUBLE PRECISION,
ADD COLUMN     "pedigreePower" DOUBLE PRECISION,
ADD COLUMN     "rank" INTEGER,
ADD COLUMN     "rawScore" DOUBLE PRECISION,
ADD COLUMN     "weightEffect" DOUBLE PRECISION;
