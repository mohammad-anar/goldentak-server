import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.race.count();
  console.log('RACE_COUNT:' + count);
  await prisma.$disconnect();
}

check();
