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
      status: a.status,
      timeAgo: formatTimeAgo(a.createdAt),
    }));

  return activities;
};

export const SystemService = {
  getLockdownStatus,
  enableLockdown,
  disableLockdown,
  setLastResultUpdate,
  getDashboardStats,
  getUserActivityChart,
  getRecentActivity,
};
