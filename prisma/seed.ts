import { PrismaClient, RaceStatus, Category } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding algorithm settings from ARGOLİTMA.xlsx weights...");

  // ── Algorithm Weights (exact values from ARGOLİTMA.xlsx row 2 parameters) ──
  const settings = [
    { key: "WEIGHT_HORSE",    value: 45,   label: "Horse Power Weight",       category: "horse",     description: "Multiplier for horsePower component (wins×4 + 2nds×3 + 3rds×2 + 4ths×1) / totalRaces", minValue: 0, maxValue: 100 },
    { key: "WEIGHT_JOCKEY",   value: 35,   label: "Jockey Power Weight",      category: "jockey",    description: "Multiplier for jockeyPower component", minValue: 0, maxValue: 100 },
    { key: "WEIGHT_SIRE",     value: 8,    label: "Sire Power Weight",        category: "sire",      description: "Multiplier for sirePower (sire offspring stats)", minValue: 0, maxValue: 50 },
    { key: "WEIGHT_DAM",      value: 6,    label: "Dam Power Weight",         category: "dam",       description: "Multiplier for damPower (dam progeny stats)", minValue: 0, maxValue: 50 },
    { key: "WEIGHT_DAMSIRE",  value: 2,    label: "Dam Sire Power Weight",    category: "damsire",   description: "Multiplier for damSirePower (maternal grandsire)", minValue: 0, maxValue: 20 },
    { key: "WEIGHT_PEDIGREE", value: 5,    label: "Pedigree Average Weight",  category: "pedigree",  description: "Multiplier for avg(sire, dam, damSire) pedigree power", minValue: 0, maxValue: 30 },
    { key: "WEIGHT_EARNING",  value: 5,    label: "Earning Power Weight",     category: "earning",   description: "Multiplier for earningPower = (horseAvgEarning / fieldAvg) - 1", minValue: 0, maxValue: 30 },
    { key: "WEIGHT_WEIGHT",   value: 10,   label: "Weight Effect Multiplier", category: "weight",    description: "Multiplier for weightEffect = (avgFieldWeight - horseWeight) / avgFieldWeight", minValue: 0, maxValue: 30 },
    { key: "THRESH_SMALL",    value: 20,   label: "SMALL Category Threshold", category: "threshold", description: "Diff from top score <= 20 -> SMALL (KÜÇÜK)", minValue: 0, maxValue: 200 },
    { key: "THRESH_MEDIUM",   value: 50,   label: "MEDIUM Category Threshold",category: "threshold", description: "Diff from top score <= 50 -> MEDIUM (ORTA)", minValue: 0, maxValue: 200 },
    { key: "THRESH_BIG",      value: 57,   label: "BIG Category Threshold",   category: "threshold", description: "Diff from top score <= 57 -> BIG (BÜYÜK)", minValue: 0, maxValue: 200 },
  ];

  for (const s of settings) {
    await prisma.algorithmSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, label: s.label, description: s.description, category: s.category, minValue: s.minValue, maxValue: s.maxValue },
      create: s,
    });
  }
  console.log(`Seeded ${settings.length} algorithm settings.`);

  // ── Legal Documents ────────────────────────────────────────────────────────
  await prisma.legalDocument.upsert({
    where: { type: "PRIVACY_POLICY" },
    update: {},
    create: { type: "PRIVACY_POLICY", content: "Privacy Policy content goes here." },
  });
  await prisma.legalDocument.upsert({
    where: { type: "TERMS_AND_CONDITIONS" },
    update: {},
    create: { type: "TERMS_AND_CONDITIONS", content: "Terms and Conditions content goes here." },
  });
  console.log("Seeded legal documents.");

  console.log("Seed complete ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
