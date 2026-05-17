import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getAllUsers = async (query: {
  page?: string;
  limit?: string;
  searchTerm?: string;
  subscriptionStatus?: string;
}) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const skip = (page - 1) * limit;

  const whereConditions: any = {};
  const andConditions: any[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { deviceId: { contains: query.searchTerm, mode: "insensitive" } },
        { email: { contains: query.searchTerm, mode: "insensitive" } },
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { username: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.subscriptionStatus === "subscribed") {
    andConditions.push({
      subscription: {
        isActive: true,
        endDate: { gte: new Date() },
      },
    });
  } else if (query.subscriptionStatus === "unsubscribed") {
    andConditions.push({
      OR: [
        { subscription: null },
        {
          subscription: {
            OR: [
              { isActive: false },
              { endDate: { lt: new Date() } },
            ],
          },
        },
      ],
    });
  }

  if (andConditions.length > 0) {
    whereConditions.AND = andConditions;
  }

  const result = await prisma.user.findMany({
    where: whereConditions,
    skip,
    take: limit,
    include: {
      subscription: true,
      _count: {
        select: { notifications: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const total = await prisma.user.count({
    where: whereConditions,
  });

  const totalPage = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    data: result,
  };
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
