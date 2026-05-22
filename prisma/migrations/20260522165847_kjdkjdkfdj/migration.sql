/*
  Warnings:

  - You are about to drop the column `damSirePower` on the `race_entries` table. All the data in the column will be lost.
  - You are about to drop the column `earningPower` on the `race_entries` table. All the data in the column will be lost.
  - You are about to drop the column `fatherPower` on the `race_entries` table. All the data in the column will be lost.
  - You are about to drop the column `motherPower` on the `race_entries` table. All the data in the column will be lost.
  - You are about to drop the column `pedigreePower` on the `race_entries` table. All the data in the column will be lost.
  - You are about to drop the column `rawScore` on the `race_entries` table. All the data in the column will be lost.
  - You are about to drop the column `weightEffect` on the `race_entries` table. All the data in the column will be lost.
  - You are about to drop the `algorithm_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "race_entries" DROP COLUMN "damSirePower",
DROP COLUMN "earningPower",
DROP COLUMN "fatherPower",
DROP COLUMN "motherPower",
DROP COLUMN "pedigreePower",
DROP COLUMN "rawScore",
DROP COLUMN "weightEffect";

-- DropTable
DROP TABLE "algorithm_settings";
