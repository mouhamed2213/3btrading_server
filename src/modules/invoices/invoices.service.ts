import { env } from "../../config/env.js";
import type {
  InvoiceCategory,
  InvoiceType,
  PaymentMethod,
} from "../../generated/prisma/enums.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { startOfDay } from "../../lib/http.js";
import { prisma, Prisma, type Tx } from "../../lib/prisma.js";
import { nextReference } from "../../lib/references.js";
import {
  QUANTITY_UNIT,
  totalQuantity,
  worksiteAmount,
} from "../worksites/worksites.service.js";
import { computeTotals } from "./totals.js";

const PREFIX: Record<InvoiceType, string> = {
  PROFORMA: "PRO",
  ACOMPTE: "ACO",
  DEFINITIVE: "FAC",
};

export type LineData = {
  label: string;
  quantity: number;
  unitPrice: number;
  partId?: string | null;
  equipmentId?: string | null;
};

export const invoiceDetailInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      type: true,
      ninea: true,
      address: true,
      phone: true,
    },
  },
  lines: true,
  payments: { orderBy: { paidAt: "desc" } },
  reminders: { orderBy: { sentAt: "desc" } },
} satisfies Prisma.InvoiceInclude;

/** Ajoute le solde et l'indicateur de retard attendus par l'interface. */
export function decorate<
  T extends {
    total: number;
    paidAmount: number;
    status: string;
    dueDate: Date;
  },
>(invoice: T) {
  const balance = invoice.total - invoice.paidAmount;
  const open = invoice.status === "IMPAYEE" || invoice.status === "PARTIELLE";
  return {
    ...invoice,
    balance,
    isOverdue: open && invoice.dueDate < startOfDay(),
  };
}

const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
const fmtN = (n: number) => n.toLocaleString("fr-FR");

// ───────────── Effets d'une vente (facture définitive) ─────────────

async function applySaleEffects(tx: Tx, lines: LineData[]) {
  for (const l of lines) {
    if (l.partId) {
      const { count } = await tx.part.updateMany({
        where: { id: l.partId, stockQuantity: { gte: l.quantity } },
        data: { stockQuantity: { decrement: l.quantity } },
      });
      if (count === 0) throw conflict(`Stock insuffisant pour « ${l.label} »`);
    }
    if (l.equipmentId) {
      const { count } = await tx.equipment.updateMany({
        where: { id: l.equipmentId, isForSale: true, status: "DISPONIBLE" },
        data: { status: "VENDU", isPublished: false },
      });
      if (count === 0)
        throw conflict(`« ${l.label} » n'est plus disponible à la vente`);
    }
  }
}

async function revertSaleEffects(tx: Tx, lines: LineData[]) {
  for (const l of lines) {
    if (l.partId)
      await tx.part.update({
        where: { id: l.partId },
        data: { stockQuantity: { increment: l.quantity } },
      });
    if (l.equipmentId)
      await tx.equipment.updateMany({
        where: { id: l.equipmentId, status: "VENDU" },
        data: { status: "DISPONIBLE" },
      });
  }
}

// ───────────── Création ─────────────

type NewInvoice = {
  type: InvoiceType;
  customerId: string;
  category?: InvoiceCategory;
  reservationId?: string | null;
  worksiteId?: string | null;
  dueDate: Date;
  taxRate?: number;
  notes?: string | null;
  lines: LineData[];
};

export async function createInvoice(tx: Tx, input: NewInvoice) {
  if (
    !(await tx.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true },
    }))
  )
    throw notFound("Client");
  const taxRate = input.taxRate ?? env.TAX_RATE;
  const lines = input.lines.map((l) => ({
    ...l,
    total: l.quantity * l.unitPrice,
  }));
  const totals = computeTotals(lines, taxRate);
  console.error(totals)
  if (totals.total <= 0) {
    throw badRequest(
      "Le montant de la facture est nul : tout est déjà facturé ou réglé par acomptes",
    );
  }
  const category =
    input.category ??
    (input.reservationId
      ? "LOCATION"
      : input.worksiteId
        ? "CHANTIER"
        : "VENTE");

  const invoice = await tx.invoice.create({
    data: {
      number: await nextReference(tx, PREFIX[input.type]),
      type: input.type,
      status: input.type === "PROFORMA" ? "A_VALIDER" : "IMPAYEE",
      category,
      customerId: input.customerId,
      reservationId: input.reservationId,
      worksiteId: input.worksiteId,
      dueDate: input.dueDate,
      taxRate,
      notes: input.notes,
      ...totals,
      lines: { create: lines },
    },
    include: invoiceDetailInclude,
  });
  if (input.type === "DEFINITIVE") await applySaleEffects(tx, lines);
  return decorate(invoice);
}

/** Client à terme : facturation en fin de mois (celui de la date de repli). Sinon : date de repli. */
function dueDateFor(
  customer: { paymentTerms: string },
  requested: Date | undefined,
  fallback: Date,
) {
  if (requested) return requested;
  if (customer.paymentTerms === "A_TERME") {
    return new Date(
      Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth() + 1, 0),
    );
  }
  return fallback;
}

/** Acomptes et factures définitives déjà émis pour la même source → lignes de déduction (évite la double facturation). */
async function deductionLines(
  tx: Tx,
  source: { reservationId: string } | { worksiteId: string },
): Promise<LineData[]> {
  const previous = await tx.invoice.findMany({
    where: {
      ...source,
      type: { in: ["ACOMPTE", "DEFINITIVE"] },
      status: { not: "ANNULEE" },
    },
    select: { number: true, type: true, subtotal: true },
    orderBy: { createdAt: "asc" },
  });
  return previous.map((p) => ({
    label: `${p.type === "ACOMPTE" ? "Acompte" : "Facturation précédente"} ${p.number} (déduction)`,
    quantity: 1,
    unitPrice: -p.subtotal,
  }));
}

type SourceInput = { type: InvoiceType; amount?: number; dueDate?: Date };

function lineSetFor(
  input: SourceInput,
  label: string,
  fullAmount: number,
  quantity: number,
  unitPrice: number,
): LineData[] {
  if (input.type === "ACOMPTE") {
    const amount = input.amount ?? fullAmount;
    if (amount <= 0 || amount > fullAmount)
      throw badRequest(
        `Montant d'acompte invalide (max ${fmtN(fullAmount)} FCFA HT)`,
      );
    return [{ label: `Acompte — ${label}`, quantity: 1, unitPrice: amount }];
  }
  return [{ label, quantity, unitPrice }];
}

export async function createFromReservation(
  reservationId: string,
  input: SourceInput,
) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { equipment: true, customer: true },
    });
    if (!r) throw notFound("Réservation");
    if (r.status === "ANNULEE") throw badRequest("Réservation annulée");
    const unit = r.pricing === "ROTATION" ? "rotation(s)" : "jour(s)";
    const label = `Location ${r.equipment.name} du ${fmt(r.startDate)} au ${fmt(r.endDate)} — ${r.quantity} ${unit}${r.isDegressive ? ", tarif dégressif" : ""}, opérateur et carburant inclus`;
    let lines = lineSetFor(
      input,
      label,
      r.totalAmount,
      r.quantity,
      r.unitPrice,
    );
    if (input.type === "DEFINITIVE")
      lines = [...lines, ...(await deductionLines(tx, { reservationId }))];
    return createInvoice(tx, {
      type: input.type,
      customerId: r.customerId,
      reservationId,
      dueDate: dueDateFor(
        r.customer,
        input.dueDate,
        input.type === "DEFINITIVE" ? r.endDate : r.startDate,
      ),
      lines,
    });
  });
}

export async function createFromWorksite(
  worksiteId: string,
  input: SourceInput,
) {
  return prisma.$transaction(async (tx) => {
    const w = await tx.worksite.findUnique({
      where: { id: worksiteId },
      include: { customer: true },
    });
    if (!w) throw notFound("Chantier");
    if (w.status === "ANNULE") throw badRequest("Chantier annulé");
    const unit = QUANTITY_UNIT[w.pricing];

    let fullAmount: number;
    let label: string;
    if (input.type === "DEFINITIVE") {
      // Facturation de l'avancement réel (situation de travaux)
      const qty = await totalQuantity(worksiteId, tx);
      if (w.pricing !== "FORFAIT" && qty === 0)
        throw badRequest("Aucune quantité saisie : rien à facturer");
      fullAmount = worksiteAmount(w, qty);
      label =
        w.pricing === "FORFAIT"
          ? `${w.name} — forfait`
          : `${w.name} — ${qty} ${unit} réalisés × ${fmtN(w.unitPrice)} FCFA`;
    } else {
      // Devis / acompte : sur la quantité estimée
      if (w.pricing !== "FORFAIT" && !w.estimatedQuantity)
        throw badRequest(
          "Quantité estimée requise pour établir une proforma ou un acompte",
        );
      fullAmount = worksiteAmount(w, w.estimatedQuantity ?? 0);
      label =
        w.pricing === "FORFAIT"
          ? `${w.name} — forfait`
          : `${w.name} — ${w.estimatedQuantity} ${unit} estimés × ${fmtN(w.unitPrice)} FCFA`;
    }
    if (input.type === "ACOMPTE" && input.amount === undefined)
      throw badRequest("Le montant de l'acompte est requis pour un chantier");

    let lines = lineSetFor(input, label, fullAmount, 1, fullAmount);
    if (input.type === "DEFINITIVE")
      lines = [...lines, ...(await deductionLines(tx, { worksiteId }))];
    return createInvoice(tx, {
      type: input.type,
      customerId: w.customerId,
      worksiteId,
      dueDate: dueDateFor(w.customer, input.dueDate, new Date()),
      lines,
    });
  });
}

/** Proforma validée → acompte ou facture définitive (la proforma passe en CONVERTIE). */
export async function convertProforma(
  id: string,
  input: { type: "ACOMPTE" | "DEFINITIVE"; amount?: number; dueDate?: Date },
) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.invoice.findUnique({
      where: { id },
      include: { lines: true, customer: true },
    });
    if (!p) throw notFound("Facture");
    if (p.type !== "PROFORMA" || p.status !== "A_VALIDER")
      throw badRequest("Seule une proforma à valider peut être convertie");

    let lines: LineData[] = p.lines.map(
      ({ label, quantity, unitPrice, partId, equipmentId }) => ({
        label,
        quantity,
        unitPrice,
        partId,
        equipmentId,
      }),
    );
    if (input.type === "ACOMPTE") {
      const amount = input.amount ?? p.subtotal;
      if (amount <= 0 || amount > p.subtotal)
        throw badRequest(
          `Montant d'acompte invalide (max ${fmtN(p.subtotal)} FCFA HT)`,
        );
      lines = [
        {
          label: `Acompte — proforma ${p.number}`,
          quantity: 1,
          unitPrice: amount,
        },
      ];
    }
    const invoice = await createInvoice(tx, {
      type: input.type,
      customerId: p.customerId,
      category: p.category,
      reservationId: p.reservationId,
      worksiteId: p.worksiteId,
      taxRate: p.taxRate,
      dueDate: dueDateFor(p.customer, input.dueDate, new Date()),
      notes: `Issue de la proforma ${p.number}`,
      lines,
    });
    await tx.invoice.update({ where: { id }, data: { status: "CONVERTIE" } });
    return invoice;
  });
}

export async function cancelInvoice(id: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!inv) throw notFound("Facture");
    if (inv.status === "ANNULEE" || inv.status === "CONVERTIE")
      throw badRequest(`Facture déjà ${inv.status}`);
    if (inv.paidAmount > 0)
      throw conflict("Des paiements sont enregistrés : annulation impossible");
    if (inv.type === "DEFINITIVE") await revertSaleEffects(tx, inv.lines);
    await tx.invoice.update({ where: { id }, data: { status: "ANNULEE" } });
    return decorate(
      await tx.invoice.findUniqueOrThrow({
        where: { id },
        include: invoiceDetailInclude,
      }),
    );
  });
}

// ───────────── Paiements & reçus ─────────────

export async function recordPayment(
  invoiceId: string,
  input: {
    amount: number;
    method: PaymentMethod;
    transactionRef?: string | null;
    paidAt?: Date;
    notes?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw notFound("Facture");
    if (inv.type === "PROFORMA")
      throw badRequest(
        "Une proforma ne s'encaisse pas : convertissez-la en acompte ou en facture",
      );
    if (inv.status === "ANNULEE" || inv.status === "PAYEE")
      throw conflict(`Facture ${inv.status} : encaissement impossible`);
    const balance = inv.total - inv.paidAmount;
    if (input.amount > balance)
      throw badRequest(
        `Montant supérieur au solde restant (${fmtN(balance)} FCFA)`,
      );

    const paidAmount = inv.paidAmount + input.amount;
    // Verrou optimiste : refuse si un autre encaissement a eu lieu entre-temps
    const { count } = await tx.invoice.updateMany({
      where: { id: invoiceId, paidAmount: inv.paidAmount },
      data: {
        paidAmount,
        status: paidAmount >= inv.total ? "PAYEE" : "PARTIELLE",
      },
    });
    if (count === 0)
      throw conflict("La facture vient d'être modifiée, veuillez réessayer");

    const payment = await tx.payment.create({
      data: {
        ...input,
        invoiceId,
        receiptNumber: await nextReference(tx, "REC"),
      },
    });
    const invoice = decorate(
      await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: invoiceDetailInclude,
      }),
    );
    return { payment, invoice };
  });
}

// ───────────── Indicateurs ─────────────

export async function getBillingSummary() {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const today = startOfDay();
  const [billed, collected, open] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        type: { not: "PROFORMA" },
        status: { notIn: ["ANNULEE", "CONVERTIE"] },
        issueDate: { gte: monthStart },
      },
      _sum: { total: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["IMPAYEE", "PARTIELLE"] } },
      select: { total: true, paidAmount: true, dueDate: true },
    }),
  ]);
  return {
    billedThisMonth: billed._sum.total ?? 0,
    collectedThisMonth: collected._sum.amount ?? 0,
    unpaidAmount: open.reduce((s, i) => s + i.total - i.paidAmount, 0),
    unpaidCount: open.length,
    overdueCount: open.filter((i) => i.dueDate < today).length,
  };
}
