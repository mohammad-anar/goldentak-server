import { prisma } from '../../../helpers/prisma.js';
import ApiError from '../../../errors/ApiError.js';

const createOrUpdate = async (type: string, content: string) => {
  const result = await prisma.legalDocument.upsert({
    where: { type },
    update: { content },
    create: { type, content },
  });
  return result;
};


const getByType = async (type: string) => {
  let result = await prisma.legalDocument.findUnique({
    where: { type },
  });

  if (!result) {
    const defaultContents: Record<string, string> = {
      TERMS_AND_CONDITIONS: "<h1>Terms and Conditions</h1><p>Welcome to GoldenTak. Please read these terms and conditions carefully before using our service.</p>",
      PRIVACY_POLICY: "<h1>Privacy Policy</h1><p>Your privacy is important to us. This policy details how we handle your data.</p>",
      ABOUT_US: "<h1>About Us</h1><p>GoldenTak is your premier horse racing analysis and AI prediction platform.</p>"
    };

    const uppercaseType = type.toUpperCase();
    if (defaultContents[uppercaseType]) {
      result = await prisma.legalDocument.create({
        data: {
          type: uppercaseType,
          content: defaultContents[uppercaseType]
        }
      });
    }
  }

  if (!result) throw new ApiError(404, 'Document not found');
  return result;
};

const getAll = async () => {
  return await prisma.legalDocument.findMany();
};

export const LegalService = {
  createOrUpdate,
  getByType,
  getAll,
};
