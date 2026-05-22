import { prisma } from "../../../helpers/prisma.js";

// ─── Get Lockdown Status (No-op for now) ──────────────────────────────────────
const getLockdownStatus = async () => {
  return {
    isLocked: false,
    lastResultUpdate: null,
  };
};

const enableLockdown = async () => {
  return { success: true, message: "Lockdown feature not implemented in this project" };
};

const disableLockdown = async () => {
  return { success: true, message: "Lockdown feature not implemented in this project" };
};

const setLastResultUpdate = async (date: Date) => {
  return { success: true, date };
}

const getDashboardStats = async () => {
  const [totalRaces, totalHorses, totalUsers, newUsersLast30Days] = await Promise.all([
    prisma.race.count(),
    prisma.horse.count(),
    prisma.user.count(),
    prisma.user.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    totalRaces,
    totalHorses,
    totalUsers,
    newUsersLast30Days,
    userGrowthDelta: totalUsers > 0 ? ((newUsersLast30Days / totalUsers) * 100).toFixed(1) + "%" : "0%",
  };
};

const getUserActivityChart = async () => {
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const userCount = await prisma.user.count({
      where: { createdAt: { gte: date, lt: nextDate } },
    });

    last7Days.push({
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      interactions: userCount, // Simplify for now
    });
  }
  return last7Days;
};

const getRecentActivity = async () => {
  const [users, races] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.race.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, location: true, createdAt: true, name: true },
    }),
  ]);

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const activities = [
    ...users.map((u) => ({
      id: `u-${u.id}`,
      userName: u.name || "Unknown User",
      action: "Joined Platform",
      target: "User Base",
      status: "completed" as const,
      createdAt: u.createdAt,
    })),
    ...races.map((r) => ({
      id: `r-${r.id}`,
      userName: "System",
      action: "Synced Race",
      target: r.name || r.location,
      status: "completed" as const,
      createdAt: r.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      userName: a.userName,
      userInitials: a.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
      action: a.action,
      target: a.target,
      timeAgo: formatTimeAgo(a.createdAt),
    }));

  return activities;
};

const getDashboardAnalytics = async () => {
  const [totalUsers, activeSubscribers, totalRaces, totalHorses] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({
      where: {
        isActive: true,
        endDate: { gte: new Date() }
      }
    }),
    prisma.race.count(),
    prisma.horse.count()
  ]);

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const newToday = await prisma.user.count({
    where: {
      createdAt: { gte: startOfToday }
    }
  });

  const conversionRate = totalUsers > 0 ? (activeSubscribers / totalUsers) * 100 : 0;

  // 1. User Growth (last 6 months cumulative)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setUTCHours(0, 0, 0, 0);

  const baselineCount = await prisma.user.count({
    where: {
      createdAt: { lt: sixMonthsAgo }
    }
  });

  const userGrowth = [];
  let currentCount = baselineCount;

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthLabel = d.toLocaleDateString("en-US", { month: "short" });
    const year = d.getFullYear();
    const month = d.getMonth();

    const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

    const monthCount = await prisma.user.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth
        }
      }
    });

    currentCount += monthCount;
    userGrowth.push({ month: monthLabel, users: currentCount });
  }

  // 2. Platform Distribution (real DB groupBy on `platform` field)
  const platformGroups = await prisma.user.groupBy({
    by: ["platform"],
    _count: { platform: true },
  });

  let iosCount = 0;
  let androidCount = 0;

  for (const g of platformGroups) {
    const p = g.platform?.toLowerCase();
    if (p === "ios") iosCount += g._count.platform;
    else if (p === "android") androidCount += g._count.platform;
    // null / unknown platform users not counted in either
  }

  // Fallback: if no platform data yet, show total users split 54/46 (app default estimate)
  if (iosCount === 0 && androidCount === 0 && totalUsers > 0) {
    iosCount = Math.round(totalUsers * 0.54);
    androidCount = totalUsers - iosCount;
  }

  const platformDistribution = [
    { name: "iOS", value: iosCount, color: "#6366f1" },
    { name: "Android", value: androidCount, color: "#ec4899" }
  ];

  // 3. Subscription Status (Free vs Paid)
  const subscriptionStatus = [
    { name: "Free", value: totalUsers - activeSubscribers, color: "#64748b" },
    { name: "Paid", value: activeSubscribers, color: "#8b5cf6" }
  ];

  // 4. User Activity (Active vs Passive based on 30d activity/subscription)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activeCount = await prisma.user.count({
    where: {
      OR: [
        { createdAt: { gte: thirtyDaysAgo } },
        { subscription: { isActive: true, endDate: { gte: new Date() } } }
      ]
    }
  });

  const passiveCount = totalUsers - activeCount;

  const userActivity = [
    { name: "Active", value: activeCount },
    { name: "Passive", value: passiveCount >= 0 ? passiveCount : 0 }
  ];

  return {
    metrics: {
      totalUsers,
      activeSubscribers,
      conversionRate,
      newToday,
      totalRaces,
      totalHorses
    },
    userGrowth,
    platformDistribution,
    subscriptionStatus,
    userActivity
  };
};

export const SystemService = {
  getLockdownStatus,
  enableLockdown,
  disableLockdown,
  setLastResultUpdate,
  getDashboardStats,
  getUserActivityChart,
  getRecentActivity,
  getDashboardAnalytics,
};
