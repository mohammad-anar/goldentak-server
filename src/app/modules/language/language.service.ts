import { prisma } from "../../../helpers/prisma.js";
import ApiError from "../../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";

const updateUserLanguage = async (userId: string, language: string) => {
  // Validate language input
  const supportedLanguages = ["en", "tr", "ar"];
  if (!supportedLanguages.includes(language)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Unsupported language: ${language}. Supported languages are: ${supportedLanguages.join(", ")}`
    );
  }

  // Update user in database
  const user = await prisma.user.update({
    where: { id: userId },
    data: { language },
    select: {
      id: true,
      username: true,
      email: true,
      language: true,
    },
  });

  return user;
};

const getLanguageOverview = async () => {
  const totalUsers = await prisma.user.count({
    where: { role: "USER" },
  });

  const enCount = await prisma.user.count({
    where: { role: "USER", language: "en" },
  });

  const trCount = await prisma.user.count({
    where: { role: "USER", language: "tr" },
  });

  const arCount = await prisma.user.count({
    where: { role: "USER", language: "ar" },
  });

  // Calculate percentages
  const enPercentage = totalUsers > 0 ? parseFloat(((enCount / totalUsers) * 100).toFixed(1)) : 0;
  const trPercentage = totalUsers > 0 ? parseFloat(((trCount / totalUsers) * 100).toFixed(1)) : 0;
  const arPercentage = totalUsers > 0 ? parseFloat(((arCount / totalUsers) * 100).toFixed(1)) : 0;

  return {
    totalLanguages: 3,
    totalUsers,
    distribution: [
      { language: "English", code: "en", count: enCount, percentage: enPercentage },
      { language: "Turkish", code: "tr", count: trCount, percentage: trPercentage },
      { language: "Arabic", code: "ar", count: arCount, percentage: arPercentage },
    ],
  };
};

export const LanguageService = {
  updateUserLanguage,
  getLanguageOverview,
};
