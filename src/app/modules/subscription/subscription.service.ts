import { prisma } from "../../../helpers/prisma.js";


const getAllPlans = async () => {
  return await prisma.subscriptionPlan.findMany({
    orderBy: { price: "asc" },
  });
};

const getPlanById = async (id: string) => {
  return await prisma.subscriptionPlan.findUnique({
    where: { id },
  });
};

const createSubscription = async (data: any) => {
  const { userId, planId, startDate, endDate } = data;
  console.log("Creating subscription for user:", userId, "with plan:", planId);
  
  const planDetail = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!planDetail) {
    console.error("Plan not found for ID:", planId);
  }

  
  return await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan: planDetail?.name || "CUSTOM",
      planId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    },
    create: {
      userId,
      plan: planDetail?.name || "CUSTOM",
      planId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    },
  });
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
      planDetail: {
        select: {
          name: true,
          price: true,
        },
      },
    },
  });

  const recentSubscriptions = recentSubs.map((sub) => {
    const userDisplay = sub.user?.name || sub.user?.username || sub.user?.email || "Device User";
    const planName = sub.plan || sub.planDetail?.name || "Premium Plan";
    const amountVal = sub.planDetail?.price !== undefined ? `$${sub.planDetail.price.toFixed(2)}` : "$9.99";

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
      amount: amountVal,
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
  getAllPlans,
  getPlanById,
  createSubscription,
  createPlan,
  updatePlan,
  getSubscriptionOverview,
};

async function createPlan(data: any) {
  return await prisma.subscriptionPlan.create({
    data: {
      ...data,
      id: data.name.toLowerCase().replace(/ /g, "-"),
    },
  });
}

async function updatePlan(id: string, data: any) {
  return await prisma.subscriptionPlan.update({
    where: { id },
    data,
  });
}



