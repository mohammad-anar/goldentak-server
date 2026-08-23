import { RaceSyncService } from './src/sync/race.sync.service.js';
import { prisma } from './src/helpers/prisma.js';

async function runLiveSync() {
  console.log("==========================================");
  console.log("🚀 Starting Full Live Database Sync...");
  console.log("==========================================");

  console.log("\n[1/3] Syncing Upcoming Races (3 Days, All Regions: GB, IRE, FR, USA, AUS)...");
  const upcomingResult = await RaceSyncService.syncUpcoming(3);
  console.log("Upcoming Sync Result:", JSON.stringify(upcomingResult, null, 2));

  console.log("\n[2/3] Syncing Past Race Results (3 Days)...");
  const resultsResult = await RaceSyncService.syncResults(3);
  console.log("Results Sync Result:", JSON.stringify(resultsResult, null, 2));

  const raceCount = await prisma.race.count();
  const entryCount = await prisma.raceEntry.count();
  const countries = await prisma.race.groupBy({
    by: ['country'],
    _count: { id: true }
  });

  console.log("\n==========================================");
  console.log("📊 Updated Live Supabase Database Stats:");
  console.log(`- Total Races: ${raceCount}`);
  console.log(`- Total Race Entries: ${entryCount}`);
  console.log("- Races by Country:", JSON.stringify(countries, null, 2));
  console.log("==========================================");
}

runLiveSync().catch(console.error).finally(() => prisma.$disconnect());
