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
  const result = await prisma.legalDocument.findUnique({
    where: { type },
  });
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
