import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env, isProd } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { api } from "./routes.js";

export const app = express();

if (isProd) app.set("trust proxy", 1); // derrière un reverse proxy (Render, Railway, Nginx…)

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()), credentials: true }));
app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api", api);
app.use(notFoundHandler);
app.use(errorHandler);
