import bcrypt from "bcryptjs";
import config from "../config/index.js";
import { prisma } from "../helpers/prisma.js";
import { Role } from "../types/enum.js";

export const DEFAULT_ALGORITHM_SETTINGS = [
  {
    key: "WEIGHT_HORSE",
    value: 45,
    label: "Horse Power Weight",
    category: "horse",
    description: "Multiplier for horsePower component (wins×4 + 2nds×3 + 3rds×2 + 4ths×1) / totalRaces",
    minValue: 0,
    maxValue: 100,
  },
  {
    key: "WEIGHT_JOCKEY",
    value: 35,
    label: "Jockey Power Weight",
    category: "jockey",
    description: "Multiplier for jockeyPower component",
    minValue: 0,
    maxValue: 100,
  },
  {
    key: "WEIGHT_SIRE",
    value: 8,
    label: "Sire Power Weight",
    category: "sire",
    description: "Multiplier for sirePower (sire offspring stats)",
    minValue: 0,
    maxValue: 50,
  },
  {
    key: "WEIGHT_DAM",
    value: 6,
    label: "Dam Power Weight",
    category: "dam",
    description: "Multiplier for damPower (dam progeny stats)",
    minValue: 0,
    maxValue: 50,
  },
  {
    key: "WEIGHT_DAMSIRE",
    value: 2,
    label: "Dam Sire Power Weight",
    category: "damsire",
    description: "Multiplier for damSirePower (maternal grandsire)",
    minValue: 0,
    maxValue: 20,
  },
  {
    key: "WEIGHT_PEDIGREE",
    value: 5,
    label: "Pedigree Average Weight",
    category: "pedigree",
    description: "Multiplier for avg(sire, dam, damSire) pedigree power",
    minValue: 0,
    maxValue: 30,
  },
  {
    key: "WEIGHT_EARNING",
    value: 5,
    label: "Earning Power Weight",
    category: "earning",
    description: "Multiplier for earningPower = (horseAvgEarning / fieldAvg) - 1",
    minValue: 0,
    maxValue: 30,
  },
  {
    key: "WEIGHT_WEIGHT",
    value: 10,
    label: "Weight Effect Multiplier",
    category: "weight",
    description: "Multiplier for weightEffect = (avgFieldWeight - horseWeight) / avgFieldWeight",
    minValue: 0,
    maxValue: 30,
  },
  {
    key: "THRESH_SMALL",
    value: 20,
    label: "SMALL Category Threshold",
    category: "threshold",
    description: "Diff from top score <= 20 -> SMALL (KÜÇÜK)",
    minValue: 0,
    maxValue: 200,
  },
  {
    key: "THRESH_MEDIUM",
    value: 50,
    label: "MEDIUM Category Threshold",
    category: "threshold",
    description: "Diff from top score <= 50 -> MEDIUM (ORTA)",
    minValue: 0,
    maxValue: 200,
  },
  {
    key: "THRESH_BIG",
    value: 57,
    label: "BIG Category Threshold",
    category: "threshold",
    description: "Diff from top score <= 57 -> BIG (BÜYÜK)",
    minValue: 0,
    maxValue: 200,
  },
];

export async function seedSuperAdmin() {
  const adminEmail = config.admin.email || "admin@gmail.com";
  const adminPassword = config.admin.password || "12345678";
  const adminName = config.admin.name || "Admin";
  const adminPhone = config.admin.phone || "0000000000";
  const adminAvatar =
    config.admin.avatar ||
    "https://i.ibb.co/VWkMFBWM/pngtree-user-icon-png-image-1796659.jpg";

  console.log(`[Seed] Checking Super Admin (${adminEmail})...`);

  const isExist = await prisma.user.findFirst({
    where: {
      OR: [{ email: adminEmail }, { username: "admin" }],
    },
  });

  if (!isExist) {
    const passwordHash = await bcrypt.hash(
      adminPassword,
      config.bcrypt_salt_round || 10
    );

    await prisma.user.create({
      data: {
        name: adminName,
        username: "admin",
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        avatarUrl: adminAvatar,
        role: Role.ADMIN,
        isVerified: true,
      },
    });

    console.log("[Seed] ✅ Super admin seeded successfully.");
  } else {
    console.log("[Seed] ℹ️ Super admin already exists.");
  }
}

export async function seedAlgorithmSettings() {
  console.log("[Seed] Seeding algorithm settings...");

  for (const s of DEFAULT_ALGORITHM_SETTINGS) {
    await prisma.algorithmSetting.upsert({
      where: { key: s.key },
      update: {
        label: s.label,
        description: s.description,
        category: s.category,
        minValue: s.minValue,
        maxValue: s.maxValue,
      },
      create: s,
    });
  }

  console.log(`[Seed] ✅ Seeded ${DEFAULT_ALGORITHM_SETTINGS.length} algorithm settings.`);
}

export async function seedLegalDocuments() {
  console.log("[Seed] Seeding legal documents...");

  await prisma.legalDocument.upsert({
    where: { type: "PRIVACY_POLICY" },
    update: {},
    create: {
      type: "PRIVACY_POLICY",
      content: "Privacy Policy content goes here.",
    },
  });

  await prisma.legalDocument.upsert({
    where: { type: "TERMS_AND_CONDITIONS" },
    update: {},
    create: {
      type: "TERMS_AND_CONDITIONS",
      content: "Terms and Conditions content goes here.",
    },
  });

  console.log("[Seed] ✅ Seeded legal documents.");
}

/**
 * Main auto-seed function executed on server startup and via prisma seed.
 */
export async function autoSeedDatabase() {
  console.log("──────────────────────────────────────────");
  console.log("🌱 [AutoSeed] Starting automated database seed...");
  try {
    await seedSuperAdmin();
    await seedAlgorithmSettings();
    await seedLegalDocuments();
    console.log("🌱 [AutoSeed] Database seeding completed successfully ✅");
  } catch (error) {
    console.error("❌ [AutoSeed] Failed to seed database:", error);
    throw error;
  }
  console.log("──────────────────────────────────────────");
}
