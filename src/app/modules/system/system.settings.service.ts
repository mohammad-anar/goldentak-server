import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getAlgorithmSettings = async () => {
  let settings = await prisma.algorithmSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.algorithmSettings.create({
      data: { id: "default" },
    });
  }

  return settings;
};

const updateAlgorithmSettings = async (data: any) => {
  return await prisma.algorithmSettings.update({
    where: { id: "default" },
    data,
  });
};

export const SystemSettingsService = {
  getAlgorithmSettings,
  updateAlgorithmSettings,
};
