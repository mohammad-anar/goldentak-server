import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { CalculationService } from './src/app/modules/analysis/calculation.service.js';

const prisma = new PrismaClient();

async function run() {
  console.log("Fetching all races from DB...");
  const races = await prisma.race.findMany();
  console.log(`Found ${races.length} races.`);

  for (const race of races) {
    console.log(`Recalculating race ${race.id} (externalId: ${race.externalId}, location: ${race.location})...`);
    try {
      await CalculationService.calculateRaceScores(race.id);
      console.log(`Successfully recalculated race ${race.id}`);
    } catch (e) {
      console.error(`Failed to recalculate race ${race.id}:`, e.message);
    }
  }

  await prisma.$disconnect();
}

run();
