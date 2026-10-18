import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { Role } from "../../generated/prisma/enums.js";
import { badRequest } from "../../lib/errors.js";
import { idParam } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { requireRole } from "../../middlewares/auth.js";

export const usersRouter = Router();
usersRouter.use(requireRole("ADMIN"));

const select = { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true } as const;

const createBody = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  fullName: z.string().trim().min(2),
  password: z.string().min(8),
  role: z.enum(Role).default("STAFF"),
});
const updateBody = z.object({
  fullName: z.string().trim().min(2).optional(),
  role: z.enum(Role).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(), // réinitialisation par un admin
});

usersRouter.get("/", async (_req, res) => {
  res.json(await prisma.user.findMany({ select, orderBy: { createdAt: "asc" } }));
});

usersRouter.post("/", async (req, res) => {
  const { password, ...data } = createBody.parse(req.body);
  const user = await prisma.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 12) }, select });
  res.status(201).json(user);
});

usersRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { password, ...data } = updateBody.parse(req.body);
  if (id === req.user!.id && (data.isActive === false || (data.role && data.role !== "ADMIN"))) {
    throw badRequest("Vous ne pouvez pas retirer vos propres droits ni désactiver votre compte");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    select,
  });
  res.json(user);
});
