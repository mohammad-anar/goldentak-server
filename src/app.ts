import cors from "cors";
import express, { Application, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import config from "./config/index.js";
import { swaggerSpec } from "./config/swagger.js";
import router from "./app/routes/index.js";
import rateLimiter from "./app/middlewares/rateLimiter.js";
import globalErrorHandler from "./app/middlewares/globalErrorHandler.js";
import notFound from "./app/middlewares/notFound.js";

const app: Application = express();

// Simple request logger for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use("/uploads", express.static("uploads"));

// ─── Swagger UI ───────────────────────────────────────────────────────────────
if (config.node_env === "development") {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "Fantasy UFC API Docs",
      swaggerOptions: { persistAuthorization: true },
    })
  );

  // Expose raw spec for tools like Postman
  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

// ─── Rate Limiting (sliding window, 100 req/min per IP) ─────────────────────
app.use(rateLimiter);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/v1", router);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Fantasy UFC League API is running 🥊",
    docs: "/api-docs",
    environment: config.node_env,
    uptime: process.uptime().toFixed(2) + "s",
    timestamp: new Date().toISOString(),
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
