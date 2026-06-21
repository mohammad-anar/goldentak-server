import { prisma } from './helpers/prisma.js';

async function main() {
  const raceCount = await prisma.race.count();
  const entryCount = await prisma.raceEntry.count();
  const horseCount = await prisma.horse.count();
  const jockeyCount = await prisma.jockey.count();

  console.log(`Database Stats:`);
  console.log(`- Races: ${raceCount}`);
  console.log(`- Race Entries: ${entryCount}`);
  console.log(`- Horses: ${horseCount}`);
  console.log(`- Jockeys: ${jockeyCount}`);

  if (raceCount > 0) {
    const dates = await prisma.race.groupBy({
      by: ['date'],
      _count: { id: true },
      orderBy: { date: 'asc' }
    });
    console.log('\nRaces by Date:');
    for (const d of dates) {
      console.log(`- Date: ${d.date.toISOString().split('T')[0]}, Count: ${d._count.id}`);
    }

    const statuses = await prisma.race.groupBy({
      by: ['status'],
      _count: { id: true },
      orderBy: { status: 'asc' }
    });
    console.log('\nRaces by Status:');
    for (const s of statuses) {
      console.log(`- Status: ${s.status}, Count: ${s._count.id}`);
    }

    const races = await prisma.race.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: {
        _count: {
          select: { entries: true }
        }
      }
    });
    console.log('\nSample Races:');
    for (const r of races) {
      console.log(`ID: ${r.id}, Name: ${r.name}, Location: ${r.location}, Date: ${r.date.toISOString().split('T')[0]}, Status: ${r.status}, Prediction: "${r.predictionMessage?.substring(0, 60)}...", Runners: ${r._count.entries}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
