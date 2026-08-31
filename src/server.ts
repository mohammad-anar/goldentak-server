import app from "./app.js";
import config from "./config/index.js";
import { autoSeedDatabase } from "./db/autoSeed.js";
import { initSubscriptionCron } from "./app/cron/subscriptionCron.js";
import { initRaceCron } from "./app/cron/raceCron.js";
import { initSocket } from "./helpers/socketHelper.js";
import { initFirebase } from "./helpers/firebaseHelper.js";
import { startWorkers, stopWorkers } from "./workers/worker.bootstrap.js";

let server: any;

function isRecoverableError(error: any): boolean {
  const msg = error?.message || String(error || "");
  return (
    msg.includes("max requests limit exceeded") ||
    msg.includes("Upstash") ||
    msg.includes("BullMQ") ||
    msg.includes("Redis") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENOTFOUND")
  );
}

process.on("uncaughtException", (error) => {
  if (isRecoverableError(error)) {
    console.warn("[Server] Recoverable exception captured (Redis / Network):", error?.message || error);
    return;
  }
  console.error("Uncaught Exception detected. Shutting down...");
  console.error(error);
  process.exit(1);
});

async function bootstrap() {
  try {
    await autoSeedDatabase();

    // Start BullMQ workers (wrapped safely)
    startWorkers();

    initSubscriptionCron();
    initRaceCron();

    server = app.listen(Number(config.port), "0.0.0.0", () => {
      initSocket(server);
      initFirebase();
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`🔗 Local: http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error("Error during server startup:", error);
    process.exit(1);
  }
}

process.on("unhandledRejection", (error) => {
  if (isRecoverableError(error)) {
    console.warn("[Server] Recoverable rejection captured (Redis / Network):", (error as any)?.message || error);
    return;
  }
  console.error("Unhandled Rejection detected. Shutting down...");
  console.error(error);

  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Graceful shutdown...");
  await stopWorkers();
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Graceful shutdown...");
  await stopWorkers();
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
});

bootstrap();
