import { Router } from "express";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { idParam, paged, paginate } from "../../lib/http.js";
import { prisma, Prisma } from "../../lib/prisma.js";
import { nextReference } from "../../lib/references.js";
import { computeRentalPrice } from "./pricing.js";
import {
  completeBody,
  createReservationBody,
  listReservationsQuery,
  updateReservationBody,
} from "./reservations.schemas.js";
import {
  assertNoConflict,
  assertStatus,
  loadReservation,
  lockEquipment,
  paymentRequirement,
} from "./reservations.service.js";

export const reservationsRouter = Router();

const include = {
  customer: { select: { id: true, name: true, type: true, paymentTerms: true } },
  equipment: { select: { id: true, code: true, name: true, brand: true, status: true } },
} satisfies Prisma.ReservationInclude;

reservationsRouter.get("/", async (req, res) => {
  const query = listReservationsQuery.parse(req.query);
  const where: Prisma.ReservationWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.equipmentId && { equipmentId: query.equipmentId }),
    ...(query.customerId && { customerId: query.customerId }),
    ...(query.from && { endDate: { gte: query.from } }),
    ...(query.to && { startDate: { lte: query.to } }),
    ...(query.q && {
      OR: [
        { reference: { contains: query.q, mode: "insensitive" } },
        { customer: { name: { contains: query.q, mode: "insensitive" } } },
        { equipment: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };
  const [data, total, pending] = await Promise.all([
    prisma.reservation.findMany({ where, include, orderBy: { createdAt: "desc" }, ...paginate(query) }),
    prisma.reservation.count({ where }),
    prisma.reservation.count({ where: { status: "EN_ATTENTE" } }), // pastille du menu
  ]);
  res.json({ ...paged(data, total, query), pendingCount: pending });
});

reservationsRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { ...include, invoices: { select: { id: true, number: true, type: true, status: true, total: true, paidAmount: true } } },
  });
  if (!reservation) throw notFound("Réservation");
  const payment = await paymentRequirement({ ...reservation, customer: reservation.customer });
  res.json({ ...reservation, payment });
});

reservationsRouter.post("/", async (req, res) => {
  const body = createReservationBody.parse(req.body);
  const reservation = await prisma.$transaction(async (tx) => {
    const [customer, equipment] = await Promise.all([
      tx.customer.findUnique({ where: { id: body.customerId }, select: { id: true } }),
      tx.equipment.findUnique({ where: { id: body.equipmentId } }),
    ]);
    if (!customer) throw notFound("Client");
    if (!equipment) throw notFound("Engin");
    if (!equipment.isRentable || equipment.status === "VENDU") throw badRequest("Cet engin n'est pas disponible à la location");

    const price = computeRentalPrice(body, equipment);
    await lockEquipment(tx, equipment.id);
    await assertNoConflict(tx, equipment.id, body.startDate, body.endDate);

    return tx.reservation.create({
      data: {
        reference: await nextReference(tx, "RES"),
        customerId: body.customerId,
        equipmentId: body.equipmentId,
        startDate: body.startDate,
        endDate: body.endDate,
        pricing: body.pricing,
        siteLocation: body.siteLocation,
        operatorName: body.operatorName,
        notes: body.notes,
        ...price,
      },
      include,
    });
  });
  res.status(201).json(reservation);
});

reservationsRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const patch = updateReservationBody.parse(req.body);
  const updated = await prisma.$transaction(async (tx) => {
    const current = await loadReservation(id, tx);
    assertStatus(current.status, ["EN_ATTENTE", "CONFIRMEE"], "modifier");
    const merged = {
      startDate: patch.startDate ?? current.startDate,
      endDate: patch.endDate ?? current.endDate,
      pricing: patch.pricing ?? current.pricing,
      rotations: patch.rotations ?? (current.pricing === "ROTATION" ? current.quantity : null),
    };
    const price = computeRentalPrice(merged, current.equipment);
    await lockEquipment(tx, current.equipmentId);
    await assertNoConflict(tx, current.equipmentId, merged.startDate, merged.endDate, id);
    const { rotations: _r, ...rest } = patch;
    return tx.reservation.update({ where: { id }, data: { ...rest, pricing: merged.pricing, startDate: merged.startDate, endDate: merged.endDate, ...price }, include });
  });
  res.json(updated);
});

reservationsRouter.post("/:id/confirm", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const current = await loadReservation(id);
  assertStatus(current.status, ["EN_ATTENTE"], "confirmer");
  res.json(await prisma.reservation.update({ where: { id }, data: { status: "CONFIRMEE" }, include }));
});

// Sortie du dépôt : exige le paiement (ou le statut "à terme"), puis passe l'engin en location.
reservationsRouter.post("/:id/start", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const updated = await prisma.$transaction(async (tx) => {
    const r = await loadReservation(id, tx);
    assertStatus(r.status, ["CONFIRMEE"], "démarrer");
    if (r.equipment.status !== "DISPONIBLE") throw conflict(`L'engin n'est pas disponible au dépôt (${r.equipment.status})`);
    const payment = await paymentRequirement(r, tx);
    if (!payment.canStart) {
      throw conflict(`Paiement requis avant la sortie de machine : ${payment.paid.toLocaleString("fr-FR")} / ${payment.due.toLocaleString("fr-FR")} FCFA réglés`);
    }
    await tx.equipment.update({ where: { id: r.equipmentId }, data: { status: "EN_LOCATION" } });
    return tx.reservation.update({ where: { id }, data: { status: "EN_COURS", startedAt: new Date() }, include });
  });
  res.json(updated);
});

// Retour de la machine
reservationsRouter.post("/:id/complete", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { meterValue } = completeBody.parse(req.body ?? {});
  const updated = await prisma.$transaction(async (tx) => {
    const r = await loadReservation(id, tx);
    assertStatus(r.status, ["EN_COURS"], "terminer");
    await tx.equipment.update({
      where: { id: r.equipmentId },
      data: { status: "DISPONIBLE", ...(meterValue !== undefined && { meterValue }) },
    });
    return tx.reservation.update({ where: { id }, data: { status: "TERMINEE", completedAt: new Date() }, include });
  });
  res.json(updated);
});

reservationsRouter.post("/:id/cancel", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const current = await loadReservation(id);
  assertStatus(current.status, ["EN_ATTENTE", "CONFIRMEE"], "annuler");
  res.json(await prisma.reservation.update({ where: { id }, data: { status: "ANNULEE" }, include }));
});
