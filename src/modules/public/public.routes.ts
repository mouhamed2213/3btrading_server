import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { EquipmentCategory } from "../../generated/prisma/enums.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { idParam, paged, paginate, paginationQuery } from "../../lib/http.js";
import { prisma, Prisma } from "../../lib/prisma.js";
import { nextReference } from "../../lib/references.js";
import { publicInquiryBody } from "../inquiries/inquiries.schemas.js";
import { listPartsQuery } from "../parts/parts.schemas.js";
import { partsWhere } from "../parts/parts.service.js";

// Aucune authentification : n'expose que ce qui est publié, sans données internes (n° de série, stock exact des clients, etc.).
export const publicRouter = Router();

const images = { images: { orderBy: { position: "asc" }, select: { url: true } } } satisfies Prisma.EquipmentInclude;
const STATUS_LABEL = { DISPONIBLE: "Disponible", EN_LOCATION: "En location", MAINTENANCE: "En maintenance", VENDU: "Vendu" } as const;

type PublicEquipment = Prisma.EquipmentGetPayload<{ include: typeof images }>;
function toPublicEquipment(e: PublicEquipment) {
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    brand: e.brand,
    model: e.model,
    category: e.category,
    group: e.category === "CAMION" ? "Camions" : "Engins",
    year: e.year,
    meterValue: e.meterValue,
    meterUnit: e.meterUnit,
    meta: [e.year, `${e.meterValue.toLocaleString("fr-FR")} ${e.meterUnit === "HEURES" ? "heures" : "km"}`].filter(Boolean).join(" • "),
    powerHp: e.powerHp,
    location: e.location,
    description: e.description,
    status: e.status,
    statusLabel: STATUS_LABEL[e.status],
    salePrice: e.isForSale ? e.salePrice : null,
    rental: e.isRentable
      ? { dailyRate: e.dailyRate, rotationRate: e.rotationRate, degressiveFromDays: e.degressiveFromDays, degressiveDailyRate: e.degressiveDailyRate }
      : null,
    images: e.images.map((i) => i.url),
  };
}

const equipmentQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  group: z.enum(["Engins", "Camions"]).optional(),
  category: z.enum(EquipmentCategory).optional(),
  brand: z.string().trim().optional(),
  q: z.string().trim().optional(),
  purpose: z.enum(["sale", "rent"]).default("sale"),
});

publicRouter.get("/equipment", async (req, res) => {
  const query = equipmentQuery.parse(req.query);
  const where: Prisma.EquipmentWhereInput = {
    isPublished: true,
    ...(query.purpose === "sale" ? { isForSale: true, status: { not: "VENDU" } } : { isRentable: true, status: { not: "VENDU" } }),
    ...(query.group && { category: query.group === "Camions" ? "CAMION" : { not: "CAMION" } }),
    ...(query.category && { category: query.category }),
    ...(query.brand && { brand: { equals: query.brand, mode: "insensitive" } }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { brand: { contains: query.q, mode: "insensitive" } },
        { model: { contains: query.q, mode: "insensitive" } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.equipment.findMany({ where, include: images, orderBy: { createdAt: "desc" }, ...paginate(query) }),
    prisma.equipment.count({ where }),
  ]);
  res.json(paged(rows.map(toPublicEquipment), total, query));
});

publicRouter.get("/equipment/:id", async (req, res) => {
  const e = await prisma.equipment.findFirst({
    where: { id: idParam.parse(req.params).id, isPublished: true, status: { not: "VENDU" } },
    include: images,
  });
  if (!e) throw notFound("Équipement");
  res.json(toPublicEquipment(e));
});

const partImages = { images: { orderBy: { position: "asc" }, select: { url: true } } } satisfies Prisma.PartInclude;
type PublicPart = Prisma.PartGetPayload<{ include: typeof partImages }>;
const toPublicPart = (p: PublicPart) => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  family: p.family,
  oemReference: p.oemReference,
  compatibleModels: p.compatibleModels,
  condition: p.condition,
  isOriginal: p.isOriginal,
  price: p.price,
  inStock: p.stockQuantity > 0,
  stockQuantity: p.stockQuantity,
  warrantyMonths: p.warrantyMonths,
  description: p.description,
  images: p.images.map((i) => i.url),
});

// Recherche par marque, famille, compatibilité ou référence OEM (mêmes filtres que l'admin)
publicRouter.get("/parts", async (req, res) => {
  const query = listPartsQuery.parse(req.query);
  const where: Prisma.PartWhereInput = { AND: [{ isPublished: true }, partsWhere({ ...query, lowStock: undefined })] };
  const [rows, total] = await Promise.all([
    prisma.part.findMany({ where, include: partImages, orderBy: { name: "asc" }, ...paginate(query) }),
    prisma.part.count({ where }),
  ]);
  res.json(paged(rows.map(toPublicPart), total, query));
});

publicRouter.get("/parts/:id", async (req, res) => {
  const part = await prisma.part.findFirst({ where: { id: idParam.parse(req.params).id, isPublished: true }, include: partImages });
  if (!part) throw notFound("Pièce");
  res.json(toPublicPart(part));
});

// Marques disponibles pour le filtre du catalogue
publicRouter.get("/brands", async (_req, res) => {
  const [eq, parts] = await Promise.all([
    prisma.equipment.findMany({ where: { isPublished: true, status: { not: "VENDU" } }, distinct: ["brand"], select: { brand: true } }),
    prisma.part.findMany({ where: { isPublished: true }, distinct: ["brand"], select: { brand: true } }),
  ]);
  res.json([...new Set([...eq, ...parts].map((b) => b.brand))].sort((a, b) => a.localeCompare(b)));
});

// Demandes de réservation / devis / contact
const inquiryLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

publicRouter.post("/inquiries", inquiryLimiter, async (req, res) => {
  const { website, ...body } = publicInquiryBody.parse(req.body);
  if (website) throw badRequest("Demande refusée");
  const inquiry = await prisma.$transaction(async (tx) =>
    tx.inquiry.create({ data: { ...body, reference: await nextReference(tx, "DEM") } }),
  );
  // Le client reçoit seulement sa référence (ex. DEM-2026-091)
  res.status(201).json({ reference: inquiry.reference, message: "Demande bien reçue. Un conseiller vous contactera sous 24 heures." });
});
