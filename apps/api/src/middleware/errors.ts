import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../lib/logger.js";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "The requested resource was not found." } });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  logger.error({ err: error, path: req.path, method: req.method }, "Unhandled API error");
  const message = process.env.NODE_ENV === "production" ? "Something went wrong." : error instanceof Error ? error.message : "Unknown error";
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
};
