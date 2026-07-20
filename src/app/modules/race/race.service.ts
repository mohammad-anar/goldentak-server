import { RaceStatus } from "@prisma/client";
import { prisma } from "../../../helpers/prisma.js";
import { paginationHelper } from "../../../helpers/paginationHelper.js";
import { CacheKey, CacheService, TTL } from "../../../cache/cache.service.js";
import { Queues, JOB_NAMES } from "../../../queues/queue.registry.js";

// ─────────────────────────────────────────────────────────────────────────────
// RaceService
//
// Reads from Redis cache → PostgreSQL.
// NEVER calls The Racing API.
// NEVER calls SyncService or CalculationService.
// Dispatches BullMQ jobs for background revalidation (SWR pattern).
// ─────────────────────────────────────────────────────────────────────────────

const getAllRaces = async (filters: any) => {
  const filterHash = JSON.stringify(filters);
  const cacheKey   = CacheKey.raceList(filterHash);

  const cached = await CacheService.get(cacheKey);
  if (cached) return cached;

  const { date, location, status, search, country, ...options } = filters;
  const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);

  const where: any = {};

  if (date) {
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);
    where.date = { gte: startDate, lte: endDate };
  }

  if (location) where.location = location;
  if (status)   where.status   = status as RaceStatus;
  if (country)  where.country  = country;

  if (search) {
    where.OR = [
      { country:  { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { name:     { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.race.findMany({
      where,
      skip,
      take: limit,
      include: { _count: { select: { entries: true } } },
      orderBy: { [sortBy || "date"]: sortOrder || "asc" },
    }),
    prisma.race.count({ where }),
  ]);

  const result = {
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
    data,
  };

  await CacheService.set(cacheKey, result, TTL.RACE_LIST);

  // SWR: if data is empty for today, dispatch a background sync job
  if (date && data.length === 0) {
    Queues.race
      .add(JOB_NAMES.SYNC_UPCOMING_RACES, { days: 1 }, { priority: 1 })
      .catch((err) => console.error("[RaceService] Failed to enqueue sync:", err.message));
  }

  return result;
};

const getRaceById = async (id: string) => {
  const cacheKey = CacheKey.raceById(id);

  const cached = await CacheService.get(cacheKey);
  if (cached) return cached;

  const result = await prisma.race.findUnique({
    where: { id },
    include: {
      entries: {
        include: { horse: true, jockey: true, trainer: true },
        orderBy: [{ rank: "asc" }, { normalizedScore: "desc" }],
      },
      results: {
        include: { horse: true, jockey: true },
      },
    },
  });

  if (result) {
    await CacheService.set(cacheKey, result, TTL.RACE_DETAIL);

    // SWR: if race has no scored entries, dispatch prediction job
    const hasScores = result.entries.some((e) => e.normalizedScore !== null);
    if (!hasScores && result.entries.length > 0) {
      Queues.prediction
        .add(JOB_NAMES.CALCULATE_RACE, { raceId: id }, { priority: 1 })
        .catch((err) => console.error("[RaceService] Failed to enqueue prediction:", err.message));
    }
  }

  return result;
};

const getRaceDates = async (month?: string) => {
  const where: any = {};
  if (month) {
    const [year, m] = month.split("-");
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(m) - 1, 1));
    const endDate   = new Date(Date.UTC(parseInt(year), parseInt(m), 0, 23, 59, 59, 999));
    where.date = { gte: startDate, lte: endDate };
  }

  return CacheService.getOrSet(
    CacheKey.raceDates(month || "all"),
    TTL.RACE_LIST,
    async () => {
      const races = await prisma.race.findMany({
        where,
        select: { date: true },
        orderBy: { date: "asc" },
      });
      return Array.from(new Set(races.map((r) => r.date.toISOString().split("T")[0])));
    }
  );
};

const getRaceStatistics = async (id: string) => {
  return CacheService.getOrSet(
    CacheKey.raceStats(id),
    TTL.RACE_STATS,
    async () => {
      const race = await prisma.race.findUnique({
        where: { id },
        include: {
          entries: {
            include: {
              horse:  { include: { results: { include: { race: true } } } },
              jockey: true,
            },
          },
        },
      });

      if (!race) throw new Error("Race not found");

      const entries = race.entries ?? [];

      // Earnings
      const sortedByEarnings = [...entries].sort(
        (a, b) => (b.horse.totalEarnings || 0) - (a.horse.totalEarnings || 0)
      );
      const maxEarnings = sortedByEarnings[0]?.horse.totalEarnings || 1;
      const earnings = sortedByEarnings.slice(0, 3).map((e) => ({
        horseName:  e.horse.name,
        amount:     `£${Math.round((e.horse.totalEarnings || 0) / 1000)}K`,
        percentage: Math.round(((e.horse.totalEarnings || 0) / maxEarnings) * 100),
      }));

      // Origin
      const originMap: Record<string, number> = {};
      entries.forEach((e) => {
        const c = e.horse.country || "Other";
        originMap[c] = (originMap[c] || 0) + 1;
      });
      const totalRunners = entries.length || 1;
      const origin = Object.entries(originMap)
        .map(([country, count]) => ({ country, percentage: Math.round((count / totalRunners) * 100) }))
        .sort((a, b) => b.percentage - a.percentage);

      // Distance wins
      const distanceWins: Record<string, number> = { "1200m": 0, "1600m": 0, "2000m": 0 };
      entries.forEach((e) => {
        e.horse.results.forEach((r) => {
          if (r.position === 1 && r.race.distance) {
            const dist = r.race.distance.toLowerCase();
            if (dist.includes("1200"))     distanceWins["1200m"]++;
            else if (dist.includes("1600")) distanceWins["1600m"]++;
            else if (dist.includes("2000")) distanceWins["2000m"]++;
          }
        });
      });
      const maxDistWins = Math.max(...Object.values(distanceWins)) || 1;
      const distance = Object.entries(distanceWins).map(([label, wins]) => ({
        label,
        detail:     `W${wins}`,
        percentage: Math.round((wins / maxDistWins) * 100),
      }));

      // Surface
      let turfWins = 0, turfRuns = 0, sandWins = 0, sandRuns = 0;
      entries.forEach((e) => {
        e.horse.results.forEach((r) => {
          const surface = r.race.trackType?.toLowerCase() ?? "";
          if (surface.includes("turf")) { turfRuns++; if (r.position === 1) turfWins++; }
          else if (surface.includes("sand")) { sandRuns++; if (r.position === 1) sandWins++; }
        });
      });

      // Jockeys
      const jockeyList = entries
        .filter((e) => e.jockey)
        .map((e) => ({
          name:       e.jockey!.name,
          percentage: e.jockey!.totalRides > 0 ? Math.round((e.jockey!.wins / e.jockey!.totalRides) * 100) : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 3);

      return {
        earnings,
        origin,
        distance,
        track: [
          { surface: "Turf", detail: `W${turfWins} L${turfRuns - turfWins}`, percentage: turfRuns > 0 ? Math.round((turfWins / turfRuns) * 100) : 0 },
          { surface: "Sand", detail: `W${sandWins} L${sandRuns - sandWins}`, percentage: sandRuns > 0 ? Math.round((sandWins / sandRuns) * 100) : 0 },
        ],
        jockey: jockeyList,
      };
    }
  );
};

const getRaceLocations = async (filters: any) => {
  const filterHash = JSON.stringify(filters);
  return CacheService.getOrSet(
    CacheKey.raceLocations(filterHash),
    TTL.RACE_LOCATIONS,
    async () => {
      const { date, status, search, country } = filters;
      const where: any = {};

      if (date) {
        const s = new Date(date); s.setUTCHours(0, 0, 0, 0);
        const e = new Date(date); e.setUTCHours(23, 59, 59, 999);
        where.date = { gte: s, lte: e };
      }
      if (status)  where.status  = status as RaceStatus;
      if (country) where.country = country;
      if (search) {
        where.OR = [
          { country:  { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
          { name:     { contains: search, mode: "insensitive" } },
        ];
      }

      const races = await prisma.race.findMany({
        where,
        select: { location: true, country: true, status: true },
      });

      const locationMap: Record<string, any> = {};
      for (const race of races) {
        if (!race.location) continue;
        const key = race.location;
        if (!locationMap[key]) {
          locationMap[key] = { location: key, country: race.country || "Unknown", racesCount: 0, isLive: false };
        }
        locationMap[key].racesCount++;
        if (race.status === "LIVE") locationMap[key].isLive = true;
      }

      return Object.values(locationMap).sort((a, b) => a.location.localeCompare(b.location));
    }
  );
};

export const RaceService = {
  getAllRaces,
  getRaceById,
  getRaceDates,
  getRaceStatistics,
  getRaceLocations,
};
