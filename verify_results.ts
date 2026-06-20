import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const race = await prisma.race.findFirst({
    where: { hasPredictions: true },
    include: {
      entries: {
        orderBy: { rank: 'asc' }
      }
    }
  });

  if (!race) {
    console.log("No race with predictions found.");
    await prisma.$disconnect();
    return;
  }

  console.log("=== Race details ===");
  console.log(`ID: ${race.id}`);
  console.log(`External ID: ${race.externalId}`);
  console.log(`Location: ${race.location}`);
  console.log(`tahmin1X: ${race.tahmin1X}`);
  console.log(`riskRate: ${race.riskRate}%`);
  console.log(`predictionMessage: ${race.predictionMessage}`);
  console.log(`hasPredictions: ${race.hasPredictions}`);

  console.log("\n=== Race entries (ordered by rank) ===");
  for (const entry of race.entries) {
    console.log(`Rank ${entry.rank} - Horse ID: ${entry.horseId} - winProb: ${entry.winProb} - normalizedScore (Rating): ${entry.normalizedScore}`);
  }

  await prisma.$disconnect();
}

run();
