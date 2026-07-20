import { prisma } from "./helpers/prisma.js";
import { PredictionRankingService } from "./algorithm/prediction-ranking.service.js";

async function main() {
  const races = await prisma.race.findMany();
  console.log(`Found ${races.length} races. Recalculating...`);
  for (const race of races) {
    try {
      console.log(`Calculating for race ${race.id} (${race.location})...`);
      await PredictionRankingService.calculateForRace(race.id, "manual");
    } catch (e: any) {
      console.error(`Failed for race ${race.id}:`, e.message);
    }
  }
  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
