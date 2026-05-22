import { prisma } from "../../../helpers/prisma.js";
import ApiError from "../../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";

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

const getCurrentLoginUsers = async (query: {
  page?: string;
  limit?: string;
  searchTerm?: string;
  subscriptionStatus?: string;
}) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const skip = (page - 1) * limit;

  const whereConditions: any = {
    deviceId: { not: null },
  };
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

const getUserById = async (id: string) => {
  return await prisma.user.findUnique({
    where: { id },
    include: {
      subscription: {
        include: {
          planDetail: true
        }
      },
      _count: {
        select: { notifications: true }
      }
    }
  });
};

const updateUserSubscription = async (data: {
  deviceId: string;
  plan?: string;
  durationDays: number;
}) => {
  const user = await prisma.user.findUnique({
    where: { deviceId: data.deviceId },
    include: { subscription: true },
  });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const now = new Date();
  let startDate = now;
  let endDate = now;

  if (
    user.subscription &&
    user.subscription.isActive &&
    new Date(user.subscription.endDate) > now
  ) {
    startDate = new Date(user.subscription.startDate);
    endDate = new Date(user.subscription.endDate);
  }

  endDate.setDate(endDate.getDate() + Number(data.durationDays));

  const result = await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      plan: data.plan || "PREMIUM",
      startDate,
      endDate,
      isActive: true,
    },
    create: {
      userId: user.id,
      plan: data.plan || "PREMIUM",
      startDate,
      endDate,
      isActive: true,
    },
  });

  return result;
};

export const UserService = {
  getAllUsers,
  getCurrentLoginUsers,
  getSubscriptionStats,
  getUserById,
  updateUserSubscription,
};


