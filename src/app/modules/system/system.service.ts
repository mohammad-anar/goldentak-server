import { prisma } from "../../../helpers/prisma.js";
import ApiError from "../../../errors/ApiError.js";
import { getIO } from "../../../helpers/socketHelper.js";

// ─── Get Lockdown Status ──────────────────────────────────────────────────────

const getLockdownStatus = async () => {
  const state = await prisma.systemState.findUnique({
    where: { id: 1 },
  });
  return {
    isLocked: state?.isLocked ?? false,
    lastResultUpdate: state?.lastResultUpdate ?? null,
  };
};

// ─── Enable Lockdown ──────────────────────────────────────────────────────────

const enableLockdown = async () => {
  const result = await prisma.systemState.upsert({
    where: { id: 1 },
    update: { isLocked: true },
    create: { id: 1, isLocked: true },
  });

  // Broadcast to all connected clients
  try {
    const io = getIO();
    io.emit("system:lockdown", { locked: true });
  } catch {
    // Socket may not be initialized in all environments — ignore
  }

  return result;
};

// ─── Disable Lockdown ─────────────────────────────────────────────────────────

const disableLockdown = async () => {
  const result = await prisma.systemState.upsert({
    where: { id: 1 },
    update: { isLocked: false },
    create: { id: 1, isLocked: false },
  });

  try {
    const io = getIO();
    io.emit("system:lockdown", { locked: false });
  } catch {
    // ignore
  }

  return result;
};

// ─── Update Last Result Update ─────────────────────────────────────────────────

const setLastResultUpdate = async (date: Date) => {
  return prisma.systemState.upsert({
    where: { id: 1 },
    update: { lastResultUpdate: date },
    create: { id: 1, lastResultUpdate: date },
  });
}

const getDashboardStats = async () => {
  const [totalLeagues, totalUsers, totalFighters, newUsersLast30Days] = await Promise.all([
    prisma.league.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.fighter.count({ where: { isActive: true } }),
    prisma.user.count({
      where: {
        deletedAt: null,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    totalLeagues,
    totalUsers,
    totalFighters,
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

    const [userCount, membershipCount, tradeCount] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: date, lt: nextDate } },
      }),
      prisma.leagueMember.count({
        where: { joinedAt: { gte: date, lt: nextDate } },
      }),
      prisma.trade.count({
        where: { createdAt: { gte: date, lt: nextDate } },
      }),
    ]);

    last7Days.push({
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      interactions: userCount + membershipCount + tradeCount,
    });
  }
  return last7Days;
};

const getRecentActivity = async () => {
  const [users, leagues, trades] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.league.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { manager: { select: { name: true } } },
    }),
    prisma.trade.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { sender: { select: { name: true } } },
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
      userName: u.name,
      action: "Joined Platform",
      target: "User Base",
      status: "completed" as const,
      createdAt: u.createdAt,
    })),
    ...leagues.map((l) => ({
      id: `l-${l.id}`,
      userName: l.manager.name,
      action: "Created League",
      target: l.name,
      status: "completed" as const,
      createdAt: l.createdAt,
    })),
    ...trades.map((t) => ({
      id: `t-${t.id}`,
      userName: t.sender.name,
      action: "Proposed Trade",
      target: `Trade #${t.id.slice(-4)}`,
      status: t.status.toLowerCase() === "pending" ? "pending" as const : "completed" as const,
      createdAt: t.createdAt,
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
