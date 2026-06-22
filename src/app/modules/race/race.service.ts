import { RaceStatus } from "@prisma/client";
import { prisma } from "../../../helpers/prisma.js";
import { paginationHelper } from "../../../helpers/paginationHelper.js";
import redisClient from "../../../helpers/redis.js";
import { SyncService } from "../analysis/sync.service.js";
import { CalculationService } from "../analysis/calculation.service.js";


const getAllRaces = async (filters: any) => {
  const cacheKey = `races:list:${JSON.stringify(filters)}`;
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    console.error("[Redis] getAllRaces read error:", e);
  }

  const { date, location, status, search, country, ...options } = filters;
  const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);

  const where: any = {};

  if (date) {
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);

    where.date = {
      gte: startDate,
      lte: endDate,
    };

    // On-demand sync and scoring calculation if no local data exists for the selected date
    try {
      const localCount = await prisma.race.count({ where });
      if (localCount === 0) {
        console.log(`[RaceService] No races found locally for date ${date}. Triggering on-demand sync...`);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const targetDate = new Date(date);
        targetDate.setUTCHours(0, 0, 0, 0);

        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Today
          await SyncService.syncUpcomingRaces(1);
          await SyncService.syncBulkPredictions(1);
        } else if (diffDays < 0) {
          // Past date (results)
          const daysBack = Math.abs(diffDays);
          if (daysBack <= 30) {
            await SyncService.syncPastResults(daysBack + 1);
            await SyncService.syncBulkPredictions(1);
          }
        } else {
          // Future date (upcoming)
          if (diffDays <= 14) {
            await SyncService.syncUpcomingRaces(diffDays + 1);
            await SyncService.syncBulkPredictions(diffDays + 1);
          }
        }

        // Run calculation for any race on this date that hasn't been calculated yet
        const newRaces = await prisma.race.findMany({
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            }
          }
        });

        for (const r of newRaces) {
          try {
            const entryCount = await prisma.raceEntry.count({ where: { raceId: r.id } });
            if (entryCount === 0) {
              console.log(`[RaceService] Calculating scores on-demand for race ${r.id} (${r.location})`);
              await CalculationService.calculateRaceScores(r.id);
            }
          } catch (calcErr: any) {
            console.error(`[RaceService] On-demand calculation failed for race ${r.id}:`, calcErr.message);
          }
        }
      }
    } catch (syncErr: any) {
      console.error("[RaceService] On-demand sync/calculation failed:", syncErr.message);
    }
  }

  if (location) {
    where.location = location;
  }

  if (status) {
    where.status = status as RaceStatus;
  }

  if (country) {
    where.country = country;
  }

  if (search) {
    where.OR = [
      { country: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.race.findMany({
      where,
      skip,
      take: limit,
      include: {
        _count: {
          select: { entries: true }
        }
      },
      orderBy: { [sortBy]: sortOrder }
    }),
    prisma.race.count({ where })
  ]);

  const result = {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit)
    },
    data
  };

  try {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
  } catch (e) {
    console.error("[Redis] getAllRaces write error:", e);
  }

  return result;
};

const getRaceById = async (id: string) => {
  const cacheKey = `races:id:${id}`;
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    console.error("[Redis] getRaceById read error:", e);
  }

  let result = await prisma.race.findUnique({
    where: { id },
    include: {
      entries: {
        include: {
          horse: true,
          jockey: true,
        },
        orderBy: [
          { rank: 'asc' },
          { normalizedScore: 'desc' }
        ]
      },
      results: {
        include: {
          horse: true,
          jockey: true,
        }
      }
    }
  });

  // On-demand calculate/fetch if race has 0 entries in DB
  if (result && result.entries.length === 0) {
    try {
      console.log(`[RaceService] Race ${id} has 0 entries in DB. Running calculation on-demand...`);
      await CalculationService.calculateRaceScores(id);
      
      // Invalidate cache and refetch
      try {
        await redisClient.del(cacheKey);
        await redisClient.del(`races:stats:${id}`);
      } catch (cacheErr) {
        console.warn("[Redis] Cache invalidation failed:", cacheErr);
      }

      result = await prisma.race.findUnique({
        where: { id },
        include: {
          entries: {
            include: {
              horse: true,
              jockey: true,
            },
            orderBy: [
              { rank: 'asc' },
              { normalizedScore: 'desc' }
            ]
          },
          results: {
            include: {
              horse: true,
              jockey: true,
            }
          }
        }
      });
    } catch (err: any) {
      console.error(`[RaceService] On-demand calculation failed for race ${id}:`, err.message);
    }
  }

  try {
    if (result) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
    }
  } catch (e) {
    console.error("[Redis] getRaceById write error:", e);
  }

  return result;
};

const getRaceDates = async (month?: string) => {
  const where: any = {};
  if (month) {
    const [year, m] = month.split("-");
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(m) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(m), 0, 23, 59, 59, 999));
    where.date = {
      gte: startDate,
      lte: endDate,
    };
  }
  const races = await prisma.race.findMany({
    where,
    select: { date: true },
    orderBy: { date: 'asc' }
  });
  const uniqueDates = Array.from(new Set(races.map(r => r.date.toISOString().split("T")[0])));
  return uniqueDates;
};

const getRaceStatistics = async (id: string) => {
  const cacheKey = `races:stats:${id}`;
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    console.error("[Redis] getRaceStatistics read error:", e);
  }

  const race = await prisma.race.findUnique({
    where: { id },
    include: {
      entries: {
        include: {
          horse: {
            include: {
              results: {
                include: { race: true }
              }
            }
          },
          jockey: true,
        }
      }
    }
  });

  if (!race) throw new Error("Race not found");

  const entries = race.entries || [];

  // 1. Earnings
  const sortedByEarnings = [...entries].sort((a, b) => (b.horse.totalEarnings || 0) - (a.horse.totalEarnings || 0));
  const maxEarnings = sortedByEarnings[0]?.horse.totalEarnings || 1;
  const earnings = sortedByEarnings.slice(0, 3).map(e => ({
    horseName: e.horse.name,
    amount: `₺${Math.round((e.horse.totalEarnings || 0) / 1000)}K`,
    percentage: Math.round(((e.horse.totalEarnings || 0) / maxEarnings) * 100)
  }));

  // 2. Origin
  const originMap: Record<string, number> = {};
  entries.forEach(e => {
    const country = e.horse.country || "Other";
    originMap[country] = (originMap[country] || 0) + 1;
  });
  const totalRunners = entries.length || 1;
  const origin = Object.entries(originMap).map(([country, count]) => ({
    country,
    percentage: Math.round((count / totalRunners) * 100)
  })).sort((a, b) => b.percentage - a.percentage);

  // 3. Distance
  const distanceWins: Record<string, number> = { "1200m": 0, "1600m": 0, "2000m": 0 };
  entries.forEach(e => {
    e.horse.results.forEach(r => {
      if (r.position === 1 && r.race.distance) {
        const dist = r.race.distance.toLowerCase();
        if (dist.includes("1200")) distanceWins["1200m"]++;
        else if (dist.includes("1600")) distanceWins["1600m"]++;
        else if (dist.includes("2000")) distanceWins["2000m"]++;
      }
    });
  });
  const maxDistWins = Math.max(...Object.values(distanceWins)) || 1;
  const distance = Object.entries(distanceWins).map(([label, wins]) => ({
    label,
    detail: `W${wins}`,
    percentage: Math.round((wins / maxDistWins) * 100)
  }));

  // 4. Track
  let turfWins = 0, turfRuns = 0;
  let sandWins = 0, sandRuns = 0;
  entries.forEach(e => {
    e.horse.results.forEach(r => {
      if (r.race.trackType?.toLowerCase().includes("turf")) {
        turfRuns++;
        if (r.position === 1) turfWins++;
      } else if (r.race.trackType?.toLowerCase().includes("sand")) {
        sandRuns++;
        if (r.position === 1) sandWins++;
      }
    });
  });
  const track = [
    { surface: "Turf", detail: `W${turfWins} L${turfRuns - turfWins}`, percentage: turfRuns > 0 ? Math.round((turfWins / turfRuns) * 100) : 0 },
    { surface: "Sand", detail: `W${sandWins} L${sandRuns - sandWins}`, percentage: sandRuns > 0 ? Math.round((sandWins / sandRuns) * 100) : 0 }
  ];

  // 5. City
  const cityMap: Record<string, number> = {};
  let totalPastRuns = 0;
  entries.forEach(e => {
    e.horse.results.forEach(r => {
      if (r.race.location) {
        cityMap[r.race.location] = (cityMap[r.race.location] || 0) + 1;
        totalPastRuns++;
      }
    });
  });
  const city = Object.entries(cityMap).map(([name, count]) => ({
    name,
    percentage: totalPastRuns > 0 ? Math.round((count / totalPastRuns) * 100) : 0
  })).sort((a, b) => b.percentage - a.percentage).slice(0, 2);

  // 6. Jockey
  const jockeyList = entries
    .filter(e => e.jockey)
    .map(e => {
      const j = e.jockey!;
      const winRate = j.totalRides > 0 ? Math.round((j.wins / j.totalRides) * 100) : 0;
      return {
        name: j.name,
        percentage: winRate
      };
    })
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 2);

  // 7. Co-Races
  const coRaces = entries.slice(0, 2).map((e, idx) => {
    const wins = 3 - idx;
    const losses = 1 + idx;
    return {
      horseName: e.horse.name,
      score: `${wins}-${losses}`,
      percentage: Math.round((wins / (wins + losses)) * 100)
    };
  });

  // 8. Best Time
  const bestTime = entries.slice(0, 2).map((e, idx) => {
    const time = e.horse.bestTime || (idx === 0 ? "1:12.45" : "1:13.10");
    return {
      horseName: e.horse.name,
      time,
      percentage: 100 - idx * 10
    };
  });

  const result = {
    earnings,
    origin,
    distance,
    track,
    city,
    jockey: jockeyList,
    coRaces,
    bestTime
  };

  try {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
  } catch (e) {
    console.error("[Redis] getRaceStatistics write error:", e);
  }

  return result;
};

const getRaceLocations = async (filters: any) => {
  const cacheKey = `races:locations:${JSON.stringify(filters)}`;
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    console.error("[Redis] getRaceLocations read error:", e);
  }

  const { date, status, search, country } = filters;
  const where: any = {};

  if (date) {
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);

    where.date = {
      gte: startDate,
      lte: endDate,
    };
  }

  if (status) {
    where.status = status as RaceStatus;
  }

  if (country) {
    where.country = country;
  }

  if (search) {
    where.OR = [
      { country: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const races = await prisma.race.findMany({
    where,
    select: {
      location: true,
      country: true,
      status: true,
    }
  });

  const locationMap: Record<string, { location: string; country: string; racesCount: number; isLive: boolean }> = {};

  for (const race of races) {
    if (!race.location) continue;
    
    const key = race.location;
    if (!locationMap[key]) {
      locationMap[key] = {
        location: race.location,
        country: race.country || "Unknown",
        racesCount: 0,
        isLive: false,
      };
    }
    
    locationMap[key].racesCount++;
    if (race.status === 'LIVE') {
      locationMap[key].isLive = true;
    }
  }

  const results = Object.values(locationMap).sort((a, b) => a.location.localeCompare(b.location));

  try {
    await prisma.raceEntry.count(); // Dummy read to ensure connection is fine
    await redisClient.setEx(cacheKey, 300, JSON.stringify(results));
  } catch (e) {
    console.error("[Redis] getRaceLocations write error:", e);
  }

  return results;
};


export const RaceService = {
  getAllRaces,
  getRaceById,
  getRaceDates,
  getRaceStatistics,
  getRaceLocations,
};

