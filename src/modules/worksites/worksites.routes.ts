import { Router } from "express";
import { z } from "zod";
import { badRequest, notFound } from "../../lib/errors.js";
import { idParam, paged, paginate } from "../../lib/http.js";
import { prisma, Prisma } from "../../lib/prisma.js";
import { nextReference } from "../../lib/references.js";
import { createWorksiteBody, entryBody, listWorksitesQuery, updateWorksiteBody } from "./worksites.schemas.js";
import { QUANTITY_UNIT, totalQuantity, worksiteAmount } from "./worksites.service.js";

export const worksitesRouter = Router();

const customer = { select: { id: true, name: true } };

worksitesRouter.get("/", async (req, res) => {
  const query = listWorksitesQuery.parse(req.query);
  const where: Prisma.WorksiteWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.customerId && { customerId: query.customerId }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { reference: { contains: query.q, mode: "insensitive" } },
        { location: { contains: query.q, mode: "insensitive" } },
      ],
    }),
  };
  const [data, total, active] = await Promise.all([
    prisma.worksite.findMany({ where, include: { customer }, orderBy: { createdAt: "desc" }, ...paginate(query) }),
    prisma.worksite.count({ where }),
    prisma.worksite.count({ where: { status: "EN_COURS" } }),
  ]);
  res.json({ ...paged(data, total, query), activeCount: active });
});

worksitesRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const worksite = await prisma.worksite.findUnique({
    where: { id },
    include: {
      customer,
      entries: { orderBy: { date: "desc" }, include: { equipment: { select: { id: true, code: true, name: true } } } },
      invoices: { select: { id: true, number: true, type: true, status: true, total: true } },
    },
  });
  if (!worksite) throw notFound("Chantier");
  const quantity = await totalQuantity(id);
  res.json({
    ...worksite,
    progress: {
      unit: QUANTITY_UNIT[worksite.pricing],
      totalQuantity: quantity,
      completionPct: worksite.estimatedQuantity ? Math.min(100, Math.round((quantity / worksite.estimatedQuantity) * 100)) : null,
      amountToDate: worksiteAmount(worksite, quantity),
    },
  });
});

worksitesRouter.post("/", async (req, res) => {
  const body = createWorksiteBody.parse(req.body);
  if (body.endDate && body.endDate < body.startDate) throw badRequest("La date de fin précède la date de début");
  const worksite = await prisma.$transaction(async (tx) => {
    if (!(await tx.customer.findUnique({ where: { id: body.customerId }, select: { id: true } }))) throw notFound("Client");
    return tx.worksite.create({ data: { ...body, reference: await nextReference(tx, "CHA") }, include: { customer } });
  });
  res.status(201).json(worksite);
});

worksitesRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const patch = updateWorksiteBody.parse(req.body);
  const current = await prisma.worksite.findUnique({ where: { id } });
  if (!current) throw notFound("Chantier");
  const endDate = patch.endDate ?? current.endDate;
  if (endDate && endDate < (patch.startDate ?? current.startDate)) throw badRequest("La date de fin précède la date de début");
  const data = { ...patch, ...(patch.status === "TERMINE" && !endDate && { endDate: new Date() }) };
  res.json(await prisma.worksite.update({ where: { id }, data, include: { customer } }));
});

// Suivi quotidien : la première saisie fait passer le chantier en "EN_COURS".
worksitesRouter.post("/:id/entries", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = entryBody.parse(req.body);
  const entry = await prisma.$transaction(async (tx) => {
    const worksite = await tx.worksite.findUnique({ where: { id }, select: { status: true } });
    if (!worksite) throw notFound("Chantier");
    if (worksite.status === "ANNULE" || worksite.status === "TERMINE") throw badRequest(`Chantier ${worksite.status} : saisie impossible`);
    if (worksite.status === "PLANIFIE") await tx.worksite.update({ where: { id }, data: { status: "EN_COURS" } });
    return tx.worksiteEntry.create({ data: { ...body, worksiteId: id } });
  });
  res.status(201).json(entry);
});

const entryParams = z.object({ id: z.string().min(1), entryId: z.string().min(1) });
worksitesRouter.delete("/:id/entries/:entryId", async (req, res) => {
  const { id, entryId } = entryParams.parse(req.params);
  const { count } = await prisma.worksiteEntry.deleteMany({ where: { id: entryId, worksiteId: id } });
  if (count === 0) throw notFound("Saisie");
  res.status(204).end();
});
