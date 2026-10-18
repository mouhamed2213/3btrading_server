import { Router } from "express";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { idParam, paged, paginate } from "../../lib/http.js";
import { prisma, Prisma, type Tx } from "../../lib/prisma.js";
import { nextReference } from "../../lib/references.js";
import {
  completeMaintenanceBody,
  createMaintenanceBody,
  listMaintenanceQuery,
  updateMaintenanceBody,
} from "./maintenance.schemas.js";

export const maintenanceRouter = Router();

const include = {
  equipment: { select: { id: true, code: true, name: true, status: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.MaintenanceOrderInclude;

async function load(id: string, db: Tx | typeof prisma = prisma) {
  const order = await db.maintenanceOrder.findUnique({ where: { id }, include });
  if (!order) throw notFound("Intervention");
  return order;
}

maintenanceRouter.get("/", async (req, res) => {
  const query = listMaintenanceQuery.parse(req.query);
  const where: Prisma.MaintenanceOrderWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.kind && { kind: query.kind }),
    ...(query.equipmentId && { equipmentId: query.equipmentId }),
    ...(query.q && {
      OR: [
        { reference: { contains: query.q, mode: "insensitive" } },
        { technician: { contains: query.q, mode: "insensitive" } },
        { externalMachine: { contains: query.q, mode: "insensitive" } },
        { equipment: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };
  const [data, total, inProgress, planned] = await Promise.all([
    prisma.maintenanceOrder.findMany({ where, include, orderBy: { scheduledDate: "asc" }, ...paginate(query) }),
    prisma.maintenanceOrder.count({ where }),
    prisma.maintenanceOrder.count({ where: { status: "EN_COURS" } }),
    prisma.maintenanceOrder.count({ where: { status: "PLANIFIEE" } }),
  ]);
  res.json({ ...paged(data, total, query), inProgressCount: inProgress, plannedCount: planned });
});

maintenanceRouter.get("/:id", async (req, res) => {
  res.json(await load(idParam.parse(req.params).id));
});

maintenanceRouter.post("/", async (req, res) => {
  const body = createMaintenanceBody.parse(req.body);
  const order = await prisma.$transaction(async (tx) => {
    if (body.equipmentId && !(await tx.equipment.findUnique({ where: { id: body.equipmentId }, select: { id: true } }))) throw notFound("Engin");
    if (body.customerId && !(await tx.customer.findUnique({ where: { id: body.customerId }, select: { id: true } }))) throw notFound("Client");
    return tx.maintenanceOrder.create({ data: { ...body, reference: await nextReference(tx, "MAI") }, include });
  });
  res.status(201).json(order);
});

maintenanceRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const current = await load(id);
  if (current.status === "TERMINEE" || current.status === "ANNULEE") throw badRequest("Intervention clôturée : modification impossible");
  res.json(await prisma.maintenanceOrder.update({ where: { id }, data: updateMaintenanceBody.parse(req.body), include }));
});

// Démarrage : un engin de la flotte est immobilisé (statut MAINTENANCE)
maintenanceRouter.post("/:id/start", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const updated = await prisma.$transaction(async (tx) => {
    const order = await load(id, tx);
    if (order.status !== "PLANIFIEE") throw badRequest(`Impossible de démarrer une intervention ${order.status}`);
    if (order.kind === "INTERNE" && order.equipmentId) {
      if (order.equipment?.status === "EN_LOCATION") throw conflict("L'engin est actuellement en location");
      await tx.equipment.update({ where: { id: order.equipmentId }, data: { status: "MAINTENANCE" } });
    }
    return tx.maintenanceOrder.update({ where: { id }, data: { status: "EN_COURS", startedAt: new Date() }, include });
  });
  res.json(updated);
});

maintenanceRouter.post("/:id/complete", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = completeMaintenanceBody.parse(req.body ?? {});
  const updated = await prisma.$transaction(async (tx) => {
    const order = await load(id, tx);
    if (order.status !== "EN_COURS") throw badRequest("Seule une intervention en cours peut être terminée");
    if (order.kind === "INTERNE" && order.equipmentId) {
      await tx.equipment.updateMany({
        where: { id: order.equipmentId, status: "MAINTENANCE" },
        data: { status: "DISPONIBLE" },
      });
    }
    if (order.equipmentId && body.meterReading !== undefined) {
      await tx.equipment.update({ where: { id: order.equipmentId }, data: { meterValue: body.meterReading } });
    }
    return tx.maintenanceOrder.update({
      where: { id },
      data: { status: "TERMINEE", completedAt: new Date(), ...body },
      include,
    });
  });
  res.json(updated);
});

maintenanceRouter.post("/:id/cancel", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const updated = await prisma.$transaction(async (tx) => {
    const order = await load(id, tx);
    if (order.status !== "PLANIFIEE" && order.status !== "EN_COURS") throw badRequest(`Intervention déjà ${order.status}`);
    if (order.status === "EN_COURS" && order.kind === "INTERNE" && order.equipmentId) {
      await tx.equipment.updateMany({ where: { id: order.equipmentId, status: "MAINTENANCE" }, data: { status: "DISPONIBLE" } });
    }
    return tx.maintenanceOrder.update({ where: { id }, data: { status: "ANNULEE" }, include });
  });
  res.json(updated);
});
