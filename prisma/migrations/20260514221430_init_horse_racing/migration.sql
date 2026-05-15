-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RaceStatus" AS ENUM ('UPCOMING', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('SMALL', 'MEDIUM', 'BIG', 'X');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'PREDICTION_READY', 'RACE_STARTING', 'RACE_FINISHED', 'SUBSCRIPTION_EXPIRING');

-- CreateTable
CREATE TABLE "algorithm_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "horseWeight" DOUBLE PRECISION NOT NULL DEFAULT 45.0,
    "jockeyWeight" DOUBLE PRECISION NOT NULL DEFAULT 35.0,
    "fatherWeight" DOUBLE PRECISION NOT NULL DEFAULT 8.0,
    "motherWeight" DOUBLE PRECISION NOT NULL DEFAULT 6.0,
    "damSireWeight" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "pedigreeWeight" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "earningsWeight" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "weightEffectWeight" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "bigThreshold" INTEGER NOT NULL DEFAULT 20,
    "mediumThreshold" INTEGER NOT NULL DEFAULT 40,
    "smallThreshold" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "algorithm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horses" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "color" TEXT,
    "sex" TEXT,
    "sireName" TEXT,
    "damName" TEXT,
    "damSireName" TEXT,
    "owner" TEXT,
    "trainer" TEXT,
    "horsePower" DOUBLE PRECISION,
    "fatherPower" DOUBLE PRECISION,
    "motherPower" DOUBLE PRECISION,
    "damSirePower" DOUBLE PRECISION,
    "pedigreePower" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jockeys" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "powerScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jockeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "races" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'United Kingdom',
    "trackType" TEXT,
    "distance" TEXT,
    "prize" TEXT,
    "status" "RaceStatus" NOT NULL DEFAULT 'UPCOMING',
    "tahmin1X" TEXT,
    "riskRate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "races_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_entries" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "jockeyId" TEXT,
    "weight" DOUBLE PRECISION,
    "draw" INTEGER,
    "horsePower" DOUBLE PRECISION,
    "jockeyPower" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "category" "Category",

    CONSTRAINT "race_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_results" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "jockeyId" TEXT,
    "position" INTEGER NOT NULL,
    "time" TEXT,
    "earnings" DOUBLE PRECISION,

    CONSTRAINT "race_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletters" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'FREE',
    "subscriptionEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "horses_externalId_key" ON "horses"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "jockeys_externalId_key" ON "jockeys"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "races_externalId_key" ON "races"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "race_entries_raceId_horseId_key" ON "race_entries"("raceId", "horseId");

-- CreateIndex
CREATE UNIQUE INDEX "race_results_raceId_horseId_key" ON "race_results"("raceId", "horseId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_key" ON "legal_documents"("type");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- AddForeignKey
ALTER TABLE "race_entries" ADD CONSTRAINT "race_entries_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_entries" ADD CONSTRAINT "race_entries_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_entries" ADD CONSTRAINT "race_entries_jockeyId_fkey" FOREIGN KEY ("jockeyId") REFERENCES "jockeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_jockeyId_fkey" FOREIGN KEY ("jockeyId") REFERENCES "jockeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
