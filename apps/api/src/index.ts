import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/v1", apiRouter);
app.use(notFound);
app.use(errorHandler);

// Vercel loads the Express app as a serverless handler. Keep the listener for
// local development only; starting a persistent listener inside a Function
// invocation causes FUNCTION_INVOCATION_FAILED responses.
if (process.env.VERCEL !== "1") {
  app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT }, "BrandSentinel API listening");
  });
}

export default app;
