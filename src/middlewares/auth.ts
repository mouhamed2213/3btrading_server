import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { Role } from "../generated/prisma/enums.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw unauthorized("Session expirée ou invalide");
  }
  // Relecture en base : un compte désactivé perd l'accès immédiatement.
  const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
  if (!user?.isActive) throw unauthorized("Compte désactivé ou introuvable");
  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
