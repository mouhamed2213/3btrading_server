import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { isProd } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { Prisma } from "../lib/prisma.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} introuvable` } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Données invalides",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: { code: "UPLOAD_ERROR", message: `Fichier refusé : ${err.message}` } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ error: { code: "CONFLICT", message: "Cette valeur existe déjà" } });
    if (err.code === "P2025") return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ressource introuvable" } });
    if (err.code === "P2003")
      return res.status(409).json({ error: { code: "CONFLICT", message: "Opération impossible : des éléments liés existent" } });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "BAD_JSON", message: "Corps de requête JSON invalide" } });
  }
  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({ error: { code: "INTERNAL", message: isProd ? "Erreur interne" : String(err?.message ?? err) } });
};
