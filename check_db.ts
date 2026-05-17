import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.race.count();
  console.log('RACE_COUNT:' + count);
  const race = await prisma.race.findFirst({
    include: {
      entries: {
        include: {
          horse: true,
          jockey: true,
        }
      },
      results: {
        include: {
          horse: true,
          jockey: true,
        }
      }
    }
  });
  console.log('Race Details Sample:', JSON.stringify(race, null, 2));
  await prisma.$disconnect();
}

check();
