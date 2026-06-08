import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
  try {
    await prisma.$executeRawUnsafe(`UPDATE users SET role = 'USER' WHERE role::text = 'PREMIUM';`);
    console.log("Updated users role from PREMIUM to USER successfully");
  } catch (e) {
    console.error("Error updating roles:", e);
  }
  await prisma.$disconnect();
}

clean();
