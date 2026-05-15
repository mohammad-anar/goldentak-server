import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding algorithm settings...");
  
  await prisma.algorithmSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      horseWeight: 45.0,
      jockeyWeight: 35.0,
      fatherWeight: 8.0,
      motherWeight: 6.0,
      damSireWeight: 2.0,
      pedigreeWeight: 5.0,
      earningsWeight: 5.0,
      weightEffectWeight: 10.0,
      bigThreshold: 20,
      mediumThreshold: 40,
      smallThreshold: 60,
    },
  });

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
