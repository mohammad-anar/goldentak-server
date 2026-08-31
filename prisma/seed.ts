import { prisma } from "../src/helpers/prisma.js";
import { autoSeedDatabase } from "../src/db/autoSeed.js";

async function main() {
  await autoSeedDatabase();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
