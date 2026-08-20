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

    const countries = await prisma.race.groupBy({
      by: ['country'],
      _count: { id: true },
      orderBy: { country: 'asc' }
    });
    console.log('\nRaces by Country:');
    for (const c of countries) {
      console.log(`- Country: ${c.country}, Count: ${c._count.id}`);
    }

    const allRaces = await prisma.race.findMany();
    console.log(`\nUpdating ${allRaces.length} races with accurate country/region...`);
    const { detectRegionAndCountry } = await import('./sync/race.sync.service.js');
    for (const r of allRaces) {
      const { region, country } = detectRegionAndCountry({ course: r.location, location: r.location, region: r.region }, r.region || 'gb');
      await prisma.race.update({
        where: { id: r.id },
        data: { region, country }
      });
    }

    const updatedCountries = await prisma.race.groupBy({
      by: ['country'],
      _count: { id: true },
      orderBy: { country: 'asc' }
    });
    console.log('\nUpdated Races by Country:');
    for (const c of updatedCountries) {
      console.log(`- Country: ${c.country}, Count: ${c._count.id}`);
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
