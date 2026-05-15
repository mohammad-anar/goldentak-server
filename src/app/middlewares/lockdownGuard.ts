import { Request, Response, NextFunction } from "express";
import { prisma } from "../../helpers/prisma.js";
import ApiError from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";

const lockdownGuard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = await prisma.systemState.findUnique({
      where: { id: 1 },
    });

    if (state?.isLocked) {
      throw new ApiError(
        StatusCodes.LOCKED,
        "System is locked: UFC event in progress. Please try again later."
      );
    }

    // Attempt to resolve leagueId from common route parameters
    let leagueId: string | null = req.params.leagueId || req.body.leagueId || null;

    if (!leagueId && req.params.tradeId) {
      const trade = await prisma.trade.findUnique({ where: { id: req.params.tradeId }, select: { leagueId: true } });
      if (trade) leagueId = trade.leagueId;
    }

    if (!leagueId && req.params.id && req.originalUrl.includes("/team/")) {
      const team = await prisma.team.findUnique({ where: { id: req.params.id }, select: { leagueId: true } });
      if (team) leagueId = team.leagueId;
    }

    if (leagueId) {
      const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { status: true } });
      if (league?.status === "LOCKED") {
        throw new ApiError(
          StatusCodes.LOCKED,
          "This specific league is currently locked."
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default lockdownGuard;
