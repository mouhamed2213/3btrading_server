import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { badRequest, unauthorized } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middlewares/auth.js";

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });

const loginBody = z.object({ email: z.email().transform((e) => e.toLowerCase()), password: z.string().min(1) });
const passwordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });

const publicUser = (u: { id: string; email: string; fullName: string; role: string }) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  // Même message pour email inconnu / mauvais mot de passe / compte désactivé.
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized("Email ou mot de passe incorrect");
  }
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  res.json({ token, user: publicUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json(publicUser(user));
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = passwordBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw badRequest("Mot de passe actuel incorrect");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  res.status(204).end();
});
