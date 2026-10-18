import { Router } from "express";
import { badRequest, notFound } from "../../lib/errors.js";
import { idParam, paged, paginate } from "../../lib/http.js";
import { prisma, Prisma } from "../../lib/prisma.js";
import { nextEquipmentCode } from "../../lib/references.js";
import { requireRole } from "../../middlewares/auth.js";
import { imageUpload } from "../../middlewares/upload.js";
import { addImages, cleanupFiles } from "../media/images.service.js";
import { findReservationConflicts } from "../reservations/reservations.service.js";
import {
  availabilityQuery,
  createEquipmentBody,
  listEquipmentQuery,
  updateEquipmentBody,
  type EquipmentInput,
} from "./equipment.schemas.js";

export const equipmentRouter = Router();

const withImages = { images: { orderBy: { position: "asc" } } } satisfies Prisma.EquipmentInclude;

/** Règles croisées (valables à la création et après fusion lors d'une modification). */
function assertConsistent(e: Pick<EquipmentInput, "isRentable" | "dailyRate" | "rotationRate" | "degressiveDailyRate" | "isForSale" | "salePrice">) {
  if (e.isRentable && !e.dailyRate && !e.rotationRate) throw badRequest("Un engin louable doit avoir un tarif journalier ou par rotation");
  if (e.degressiveDailyRate && e.dailyRate && e.degressiveDailyRate >= e.dailyRate) {
    throw badRequest("Le tarif dégressif doit être inférieur au tarif journalier");
  }
  if (e.degressiveDailyRate && !e.dailyRate) throw badRequest("Le tarif dégressif nécessite un tarif journalier");
  if (e.isForSale && !e.salePrice) throw badRequest("Un engin à vendre doit avoir un prix de vente");
}

equipmentRouter.get("/", async (req, res) => {
  const query = listEquipmentQuery.parse(req.query);
  const where: Prisma.EquipmentWhereInput = {
    ...(query.category && { category: query.category }),
    ...(query.status && { status: query.status }),
    ...(query.brand && { brand: { equals: query.brand, mode: "insensitive" } }),
    ...(query.isForSale !== undefined && { isForSale: query.isForSale }),
    ...(query.isRentable !== undefined && { isRentable: query.isRentable }),
    ...(query.q && {
      OR: ["name", "brand", "model", "code", "serialNumber"].map((f) => ({ [f]: { contains: query.q, mode: "insensitive" } })),
    }),
  };
  const [data, total] = await Promise.all([
    prisma.equipment.findMany({ where, include: withImages, orderBy: { createdAt: "desc" }, ...paginate(query) }),
    prisma.equipment.count({ where }),
  ]);
  res.json(paged(data, total, query));
});

equipmentRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const equipment = await prisma.equipment.findUnique({ where: { id }, include: withImages });
  if (!equipment) throw notFound("Engin");
  res.json(equipment);
});

// Disponibilité sur une période (utile avant de créer une réservation)
equipmentRouter.get("/:id/availability", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { from, to } = availabilityQuery.parse(req.query);
  const equipment = await prisma.equipment.findUnique({ where: { id }, select: { status: true, isRentable: true } });
  if (!equipment) throw notFound("Engin");
  const conflicts = await findReservationConflicts(id, from, to);
  const rentable = equipment.isRentable && equipment.status !== "VENDU" && equipment.status !== "MAINTENANCE";
  res.json({ available: rentable && conflicts.length === 0, rentable, status: equipment.status, conflicts });
});

equipmentRouter.post("/", async (req, res) => {
  const data = createEquipmentBody.parse(req.body);
  assertConsistent(data);
  const equipment = await prisma.$transaction(async (tx) =>
    tx.equipment.create({ data: { ...data, code: await nextEquipmentCode(tx) }, include: withImages }),
  );
  res.status(201).json(equipment);
});

equipmentRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const patch = updateEquipmentBody.parse(req.body);
  const current = await prisma.equipment.findUnique({ where: { id } });
  if (!current) throw notFound("Engin");
  if (current.status === "EN_LOCATION" && patch.status) throw badRequest("Engin en location : terminez ou annulez la réservation d'abord");
  assertConsistent({ ...current, ...patch });
  res.json(await prisma.equipment.update({ where: { id }, data: patch, include: withImages }));
});

equipmentRouter.post("/:id/images", imageUpload.array("images", 8), async (req, res) => {
  const { id } = idParam.parse(req.params);
  if (!(await prisma.equipment.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Engin");
  res.status(201).json(await addImages({ equipmentId: id }, (req.files as Express.Multer.File[]) ?? []));
});

equipmentRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const images = await prisma.image.findMany({ where: { equipmentId: id }, select: { storagePath: true } });
  await prisma.equipment.delete({ where: { id } }); // 409 si réservations / maintenance liées
  await cleanupFiles(images.map((i) => i.storagePath));
  res.status(204).end();
});
