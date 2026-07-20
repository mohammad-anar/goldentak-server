import app from "./app.js";
import config from "./config/index.js";
import { seedSuperAdmin } from "./db/seedSuperAdmin.js";
import { initSubscriptionCron } from "./app/cron/subscriptionCron.js";
import { initRaceCron } from "./app/cron/raceCron.js";
import { initSocket } from "./helpers/socketHelper.js";
import { initFirebase } from "./helpers/firebaseHelper.js";
import { startWorkers, stopWorkers } from "./workers/worker.bootstrap.js";
import { AlgorithmSettingsService } from "./algorithm/algorithm-settings.service.js";

let server: any;

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception detected. Shutting down...");
  console.error(error);
  process.exit(1);
});

async function bootstrap() {
  try {
    await seedSuperAdmin();
    await AlgorithmSettingsService.seedDefaults(); // Seed algorithm weights if not present

    // Start BullMQ workers (before crons so workers are ready for first dispatch)
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
