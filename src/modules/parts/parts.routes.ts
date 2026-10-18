import { Router } from "express";
import { conflict, notFound } from "../../lib/errors.js";
import { idParam, paged, paginate } from "../../lib/http.js";
import { prisma, Prisma } from "../../lib/prisma.js";
import { requireRole } from "../../middlewares/auth.js";
import { imageUpload } from "../../middlewares/upload.js";
import { addImages, cleanupFiles } from "../media/images.service.js";
import { createPartBody, listPartsQuery, stockBody, updatePartBody } from "./parts.schemas.js";
import { partsWhere } from "./parts.service.js";

export const partsRouter = Router();

const withImages = { images: { orderBy: { position: "asc" } } } satisfies Prisma.PartInclude;

partsRouter.get("/", async (req, res) => {
  const query = listPartsQuery.parse(req.query);
  const where = partsWhere(query);
  const [data, total, lowStockCount] = await Promise.all([
    prisma.part.findMany({ where, include: withImages, orderBy: { name: "asc" }, ...paginate(query) }),
    prisma.part.count({ where }),
    prisma.part.count({ where: { stockQuantity: { lte: prisma.part.fields.lowStockThreshold } } }),
  ]);
  res.json({ ...paged(data, total, query), lowStockCount });
});

partsRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const part = await prisma.part.findUnique({ where: { id }, include: withImages });
  if (!part) throw notFound("Pièce");
  res.json(part);
});

partsRouter.post("/", async (req, res) => {
  res.status(201).json(await prisma.part.create({ data: createPartBody.parse(req.body), include: withImages }));
});

partsRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await prisma.part.update({ where: { id }, data: updatePartBody.parse(req.body), include: withImages }));
});

// Entrée (+) ou sortie (−) de stock, sans jamais passer sous zéro
partsRouter.post("/:id/stock", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { delta } = stockBody.parse(req.body);
  const { count } = await prisma.part.updateMany({
    where: { id, ...(delta < 0 && { stockQuantity: { gte: -delta } }) },
    data: { stockQuantity: { increment: delta } },
  });
  if (count === 0) {
    if (!(await prisma.part.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Pièce");
    throw conflict("Stock insuffisant pour cette sortie");
  }
  res.json(await prisma.part.findUniqueOrThrow({ where: { id }, include: withImages }));
});

partsRouter.post("/:id/images", imageUpload.array("images", 8), async (req, res) => {
  const { id } = idParam.parse(req.params);
  if (!(await prisma.part.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Pièce");
  res.status(201).json(await addImages({ partId: id }, (req.files as Express.Multer.File[]) ?? []));
});

partsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const images = await prisma.image.findMany({ where: { partId: id }, select: { storagePath: true } });
  await prisma.part.delete({ where: { id } }); // 409 si déjà facturée
  await cleanupFiles(images.map((i) => i.storagePath));
  res.status(204).end();
});
