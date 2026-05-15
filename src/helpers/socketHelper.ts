import { Server, Socket } from "socket.io";
import { prisma } from "./prisma.js";
// import { DraftService } from "../app/modules/draft/draft.service.js";
import ApiError from "../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";

let io: Server | null = null;

// TODO: If deploying to a horizontal scaling environment (AWS, DigitalOcean Load Balancers),
// migrate this in-memory map and Socket.IO server to use the @socket.io/redis-adapter.

// Store socket IDs per user
const socketMap: Map<string, Set<string>> = new Map();

export const initSocket = (server: any) => {
  io = new Server(server, {
    pingTimeout: 60000,
    cors: { origin: "*" },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Register user socket
    socket.on("register", (userId: string) => {
      if (!userId) return;
      if (!socketMap.has(userId)) socketMap.set(userId, new Set());
      socketMap.get(userId)!.add(socket.id);
      (socket as any).userId = userId;
      console.log(`✅ Registered socket ${socket.id} for user ${userId}`);
    });

    // Join a draft room
    socket.on("join_draft", async (leagueId: string) => {
      /*
      if (!leagueId) return;
      socket.join(`draft:${leagueId}`);
      console.log(`📋 Socket ${socket.id} joined draft room: ${leagueId}`);
      
      try {
        const currentSession = await DraftService.getDraftSession(leagueId);
        socket.emit("draft:sync", currentSession);
      } catch (error) {
        // Safe to ignore: the session might not be started/created yet.
      }
      */
    });
 
    // Make a pick directly via Socket.IO
    socket.on("make_pick", async (data: { leagueId: string; fighterId: string }) => {
      /*
      try {
        const { leagueId, fighterId } = data;
        const userId = (socket as any).userId;
 
        if (!userId) {
          throw new Error("Unauthenticated socket session");
        }
        if (!leagueId || !fighterId) return;
 
        // 1. Check Lockdown (Saturday Lockdown)
        const systemState = await prisma.systemState.findUnique({ where: { id: 1 } });
        if (systemState?.isLocked) {
          throw new ApiError(StatusCodes.LOCKED, "System is locked: UFC event in progress. Drafts are paused.");
        }
 
        const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { status: true } });
        if (league?.status !== "DRAFTING") {
          throw new ApiError(StatusCodes.LOCKED, "This specific league is not currently drafting.");
        }
 
        // 2. Execute the pick
        const result = await DraftService.pickFighter(leagueId, userId, data);
 
        // 3. Success is broadcasted INSIDE the service via emitDraftEvent
      } catch (error: any) {
        socket.emit("draft:error", { 
          success: false,
          statusCode: error.statusCode || StatusCodes.BAD_REQUEST,
          message: error.message || "Failed to make pick"
        });
      }
      */
    });

    // Leave a draft room
    socket.on("leave_draft", (leagueId: string) => {
      if (!leagueId) return;
      socket.leave(`draft:${leagueId}`);
      console.log(`📤 Socket ${socket.id} left draft room: ${leagueId}`);
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
      for (const [userId, sockets] of socketMap.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) socketMap.delete(userId);
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

export const getSocketIds = (userId: string): string[] => {
  return Array.from(socketMap.get(userId) || []);
};

/**
 * Emit a draft event to all sockets in a draft room.
 * e.g. emitDraftEvent(leagueId, "draft:pick", { ... })
 */
export const emitDraftEvent = (leagueId: string, event: string, data: any) => {
  const socket = getIO();
  socket.to(`draft:${leagueId}`).emit(event, data);
};

/**
 * Emit a notification to a specific user.
 */
export const emitNotification = (userId: string, data: any) => {
  const socket = getIO();
  const socketIds = getSocketIds(userId);
  socketIds.forEach((id) => socket.to(id).emit("notification", data));
};
