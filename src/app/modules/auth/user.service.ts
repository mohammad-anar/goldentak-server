import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getAllUsers = async () => {
  return await prisma.user.findMany({
    include: {
      subscription: true,
      _count: {
        select: { notifications: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

const getSubscriptionStats = async () => {
  const total = await prisma.user.count();
  const activeSubscribers = await prisma.subscription.count({
    where: {
      isActive: true,
      endDate: { gte: new Date() }
    }
  });

  return {
    totalUsers: total,
    activeSubscribers,
    conversionRate: total > 0 ? (activeSubscribers / total) * 100 : 0
  };
};

export const UserService = {
  getAllUsers,
  getSubscriptionStats
};
