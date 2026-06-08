import { prisma } from "../../../helpers/prisma.js";

const createSubscription = async (data: any) => {
  const { userId, plan, startDate, endDate } = data;
  console.log("Creating subscription for user:", userId, "with type:", plan);
  
  return await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan: plan || "WEEKLY",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    },
    create: {
      userId,
      plan: plan || "WEEKLY",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    },
  });
};

const getSubscriptionByUserId = async (userId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return {
      plan: "FREE",
      isActive: false,
      startDate: null,
      endDate: null,
    };
  }

  const isActive = subscription.isActive && new Date(subscription.endDate) > new Date();

  return {
    plan: subscription.plan,
    isActive,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
  };
};

const getSubscriptionOverview = async () => {
  const now = new Date();

  // 1. Calculate stats metrics
  const totalUsers = await prisma.user.count({
    where: { role: "USER" },
  });

  const paidUsers = await prisma.subscription.count({
    where: {
      isActive: true,
      endDate: { gte: now },
    },
  });

  const freeUsers = Math.max(0, totalUsers - paidUsers);

  const expiringSoon = await prisma.subscription.count({
    where: {
      isActive: true,
      endDate: {
        gte: now,
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    },
  });

  const cancelled = await prisma.subscription.count({
    where: {
      OR: [
        { isActive: false },
        { endDate: { lt: now } },
      ],
    },
  });

  // 2. Fetch monthly renewals chart data (last 5 months)
  const chartData = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthLabel = d.toLocaleDateString("en-US", { month: "short" });
    const year = d.getFullYear();
    const month = d.getMonth();

    const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

    const count = await prisma.subscription.count({
      where: {
        startDate: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    });

    chartData.push({ month: monthLabel, renewals: count });
  }

  // 3. Recent subscriptions
  const recentSubs = await prisma.subscription.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      user: {
        select: {
          name: true,
          username: true,
          email: true,
        },
      },
    },
  });

  const recentSubscriptions = recentSubs.map((sub) => {
    const userDisplay = sub.user?.name || sub.user?.username || sub.user?.email || "Device User";
    const planName = sub.plan || "WEEKLY";

    // Determine status
    let status = "Cancelled";
    if (sub.isActive && new Date(sub.endDate) >= now) {
      const expiringSoonThreshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (new Date(sub.endDate) <= expiringSoonThreshold) {
        status = "Expiring";
      } else {
        status = "Active";
      }
    }

    return {
      user: userDisplay,
      plan: planName,
      startDate: sub.startDate.toISOString().split("T")[0],
      expiry: sub.endDate.toISOString().split("T")[0],
      status,
    };
  });

  return {
    metrics: {
      freeUsers: freeUsers.toLocaleString(),
      paidUsers: paidUsers.toLocaleString(),
      expiringSoon: expiringSoon.toLocaleString(),
      cancelled: cancelled.toLocaleString(),
    },
    chartData,
    recentSubscriptions,
  };
};

export const SubscriptionService = {
  createSubscription,
  getSubscriptionByUserId,
  getSubscriptionOverview,
};
