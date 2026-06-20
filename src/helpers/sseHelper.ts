import { Response } from "express";

// ─────────────────────────────────────────────────────────────────────────────
// SSE CLIENT REGISTRY
// Tracks all active SSE connections keyed by raceId.
// Stored in-memory; for multi-process/horizontal-scale deployments, pair this
// with a Redis Pub/Sub adapter to fan out across processes.
// ─────────────────────────────────────────────────────────────────────────────

interface SseClient {
  id: string;
  res: Response;
}

// Map<raceId, Set<SseClient>>
const sseClients: Map<string, Set<SseClient>> = new Map();

let clientCounter = 0;

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER CLIENT
// Called by the SSE route handler when a new client connects.
// Sets up SSE headers, heartbeat, and auto-cleanup on disconnect.
// ─────────────────────────────────────────────────────────────────────────────
export function registerSseClient(raceId: string, res: Response): () => void {
  // Required SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Nginx: disable buffering
  res.flushHeaders();

  const clientId = `sse_${++clientCounter}`;
  const client: SseClient = { id: clientId, res };

  if (!sseClients.has(raceId)) {
    sseClients.set(raceId, new Set());
  }
  sseClients.get(raceId)!.add(client);

  console.log(`📡 [SSE] Client ${clientId} connected to race: ${raceId} (total: ${sseClients.get(raceId)!.size})`);

  // Send an immediate "connected" event so the client knows the stream is alive
  writeSseEvent(res, "connected", { raceId, clientId });

  // Heartbeat every 25 seconds to keep the TCP connection alive through
  // NATs and proxies (standard SSE keep-alive pattern)
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  // Cleanup function — called when client disconnects
  const cleanup = () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(raceId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        sseClients.delete(raceId);
      }
    }
    console.log(`🔌 [SSE] Client ${clientId} disconnected from race: ${raceId}`);
  };

  return cleanup;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH RACE UPDATE
// Called by the calculation controller / any service that has new race data.
// Sends a "race:update" event to every connected client for the given raceId.
// ─────────────────────────────────────────────────────────────────────────────
export function pushRaceUpdate(raceId: string, payload: object): void {
  const clients = sseClients.get(raceId);
  if (!clients || clients.size === 0) {
    // No active SSE listeners — nothing to do
    return;
  }

  const deadClients: SseClient[] = [];

  for (const client of clients) {
    try {
      writeSseEvent(client.res, "race:update", { raceId, ...payload });
    } catch {
      // Client connection is broken — mark for removal
      deadClients.push(client);
    }
  }

  // Purge dead clients
  for (const dead of deadClients) {
    clients.delete(dead);
    console.log(`🧹 [SSE] Purged dead client ${dead.id} from race: ${raceId}`);
  }

  console.log(`📨 [SSE] Pushed race:update to ${clients.size} client(s) for race: ${raceId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH RACE STATUS CHANGE
// Lightweight helper to push just a status change (LIVE / FINISHED)
// without requiring a full entry recalculation.
// ─────────────────────────────────────────────────────────────────────────────
export function pushRaceStatusChange(raceId: string, status: string): void {
  pushRaceUpdate(raceId, { status });
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE WRITE HELPER
// Formats and writes a single SSE event frame to an Express response.
// SSE format:
//   event: <eventName>\n
//   data: <JSON>\n\n
// ─────────────────────────────────────────────────────────────────────────────
function writeSseEvent(res: Response, event: string, data: object): void {
  const json = JSON.stringify(data);
  res.write(`event: ${event}\ndata: ${json}\n\n`);
}
