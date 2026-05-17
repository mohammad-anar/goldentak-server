import app from "./app.js";
import config from "./config/index.js";
import { seedSuperAdmin } from "./db/seedSuperAdmin.js";
import { initSubscriptionCron } from "./app/cron/subscriptionCron.js";
import { initRaceCron } from "./app/cron/raceCron.js";
// import { seedFighters } from "./db/seedFighters.js";
// import { startDraftEngine, stopDraftEngine } from "./helpers/draftEngine.js";
// import { initSocket } from "./helpers/socketHelper.js";

let server: any;

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception detected. Shutting down...");
  console.error(error);
  process.exit(1);
});

async function bootstrap() {
  try {
    await seedSuperAdmin();
    // await seedFighters();
    initSubscriptionCron();
    initRaceCron();


    server = app.listen(Number(config.port), "0.0.0.0", () => {
      // Initialize Socket.io
      // initSocket(server);

      // Start real-time draft heartbeat
      // startDraftEngine();

      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`🔗 Local: http://localhost:${config.port}`);
      console.log(`🔗 Network: http://10.10.7.111:${config.port}`);
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

process.on("SIGTERM", () => {
  console.log("SIGTERM received.");
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});

process.on("SIGINT", () => {
  console.log("SIGINT received.");
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});

bootstrap();
