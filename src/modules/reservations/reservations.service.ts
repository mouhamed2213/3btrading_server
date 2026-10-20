import { env } from "../../config/env.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { prisma, type Tx } from "../../lib/prisma.js";
import { withTax } from "../invoices/totals.js";

/** Statuts qui bloquent le calendrier de l'engin. */
const BLOCKING = ["EN_ATTENTE", "CONFIRMEE", "EN_COURS"] as const;

export function findReservationConflicts(
  equipmentId: string,
  from: Date,
  to: Date,
  excludeId?: string,
  db: Tx | typeof prisma = prisma,
) {
  return db.reservation.findMany({
    where: {
      equipmentId,
      status: { in: [...BLOCKING] },
      startDate: { lte: to },
      endDate: { gte: from },
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: {
      id: true,
      reference: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });
}

/** Verrou par engin : deux réservations simultanées sur le même engin sont sérialisées. */
export async function lockEquipment(tx: Tx, equipmentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${equipmentId}))`;
}

export async function assertNoConflict(
  tx: Tx,
  equipmentId: string,
  from: Date,
  to: Date,
  excludeId?: string,
) {
  const conflicts = await findReservationConflicts(
    equipmentId,
    from,
    to,
    excludeId,
    tx,
  );
  if (conflicts.length > 0) {
    const c = conflicts[0]!;
    throw conflict(
      `Engin déjà réservé sur cette période (${c.reference}, ${c.startDate.toISOString().slice(0, 10)} → ${c.endDate.toISOString().slice(0, 10)})`,
    );
  }
}

/** Total encaissé sur les factures (acompte / définitive) rattachées à la réservation. */
export async function amountPaid(
  reservationId: string,
  db: Tx | typeof prisma = prisma,
) {
  const { _sum } = await db.payment.aggregate({
    where: { invoice: { reservationId, status: { not: "ANNULEE" } } },
    _sum: { amount: true },
  });
  return _sum.amount ?? 0;
}

/**
 * Règle de sortie de machine : 100 % de la période estimée (TTC) payé avant le départ,
 * sauf client PARTENAIRE à paiement à terme (facturation fin de mois).
 */
export async function paymentRequirement(
  reservation: {
    id: string;
    totalAmount: number;
    customer: { paymentTerms: string };
  },
  db: Tx | typeof prisma = prisma,
) {
  const due = withTax(reservation.totalAmount, env.TAX_RATE);
  const paid = await amountPaid(reservation.id, db);
  const deferred = reservation.customer.paymentTerms === "A_TERME";
  return {
    due,
    paid,
    balance: Math.max(0, due - paid),
    deferred,
    canStart: deferred || paid >= due,
  };
}

export async function loadReservation(
  id: string,
  db: Tx | typeof prisma = prisma,
) {
  const r = await db.reservation.findUnique({
    where: { id },
    include: { customer: true, equipment: true },
  });
  if (!r) throw notFound("Réservation");
  return r;
}

export function assertStatus(
  current: string,
  allowed: string[],
  action: string,
) {
  if (!allowed.includes(current))
    throw badRequest(
      `Impossible de ${action} une réservation au statut ${current}`,
    );
}
