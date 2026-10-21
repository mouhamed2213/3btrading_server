import { notFound } from "../../lib/errors.js";
import { startOfDay } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { inquiryIdsForCustomer } from "../inquiries/inquiries.service.js";

export type TimelineEvent = {
  type: "RESERVATION" | "INVOICE" | "PAYMENT" | "WORKSITE" | "MAINTENANCE" | "INQUIRY";
  id: string;
  date: Date;
  reference: string;
  title: string;
  subtitle?: string;
  amount?: number;
  status?: string;
};

const TIMELINE_SIZE = 20;

/** Facturé / encaissé / reste dû : les proformas, documents annulés et proformas converties ne comptent pas. */
const BILLABLE = { type: { not: "PROFORMA" as const }, status: { notIn: ["ANNULEE" as const, "CONVERTIE" as const] } };

/** Vue d'ensemble du dossier client : indicateurs + historique des derniers événements (toutes activités confondues). */
export async function getCustomerOverview(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw notFound("Client");
  const inquiryIds = await inquiryIdsForCustomer(customer);
  const last = { take: TIMELINE_SIZE } as const;

  const [billed, openInvoices, reservationsByStatus, worksitesByStatus, maintenanceCount, inquiryCount, firstRes, firstWs, firstInv, reservations, invoices, payments, worksites, maintenance, inquiries] =
    await Promise.all([
      prisma.invoice.aggregate({ where: { customerId: id, ...BILLABLE }, _sum: { total: true, paidAmount: true } }),
      prisma.invoice.findMany({ where: { customerId: id, status: { in: ["IMPAYEE", "PARTIELLE"] } }, select: { total: true, paidAmount: true, dueDate: true } }),
      prisma.reservation.groupBy({ by: ["status"], where: { customerId: id }, _count: { _all: true } }),
      prisma.worksite.groupBy({ by: ["status"], where: { customerId: id }, _count: { _all: true } }),
      prisma.maintenanceOrder.count({ where: { customerId: id } }),
      prisma.inquiry.count({ where: { id: { in: inquiryIds } } }),
      prisma.reservation.aggregate({ where: { customerId: id }, _min: { createdAt: true } }),
      prisma.worksite.aggregate({ where: { customerId: id }, _min: { createdAt: true } }),
      prisma.invoice.aggregate({ where: { customerId: id }, _min: { createdAt: true } }),
      prisma.reservation.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, ...last, include: { equipment: { select: { name: true } } } }),
      prisma.invoice.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, ...last, select: { id: true, number: true, type: true, status: true, total: true, createdAt: true } }),
      prisma.payment.findMany({ where: { invoice: { customerId: id } }, orderBy: { paidAt: "desc" }, ...last, include: { invoice: { select: { number: true } } } }),
      prisma.worksite.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, ...last }),
      prisma.maintenanceOrder.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, ...last, include: { equipment: { select: { name: true } } } }),
      prisma.inquiry.findMany({ where: { id: { in: inquiryIds } }, orderBy: { createdAt: "desc" }, ...last }),
    ]);

  const count = (rows: { status: string; _count: { _all: number } }[], ...statuses: string[]) =>
    rows.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r._count._all, 0);
  const total = (rows: { _count: { _all: number } }[]) => rows.reduce((s, r) => s + r._count._all, 0);

  const today = startOfDay();
  const overdue = openInvoices.filter((i) => i.dueDate < today);
  const dates = [firstRes._min.createdAt, firstWs._min.createdAt, firstInv._min.createdAt].filter((d): d is Date => !!d);

  const timeline: TimelineEvent[] = [
    ...reservations.map((r): TimelineEvent => ({ type: "RESERVATION", id: r.id, date: r.createdAt, reference: r.reference, title: `Réservation — ${r.equipment.name}`, amount: r.totalAmount, status: r.status })),
    ...invoices.map((i): TimelineEvent => ({ type: "INVOICE", id: i.id, date: i.createdAt, reference: i.number, title: `Document ${i.number}`, subtitle: i.type, amount: i.total, status: i.status })),
    ...payments.map((p): TimelineEvent => ({ type: "PAYMENT", id: p.id, date: p.paidAt, reference: p.receiptNumber, title: `Paiement reçu — ${p.invoice.number}`, subtitle: p.method, amount: p.amount })),
    ...worksites.map((w): TimelineEvent => ({ type: "WORKSITE", id: w.id, date: w.createdAt, reference: w.reference, title: `Chantier — ${w.name}`, subtitle: w.location, status: w.status })),
    ...maintenance.map((m): TimelineEvent => ({ type: "MAINTENANCE", id: m.id, date: m.createdAt, reference: m.reference, title: `Intervention — ${m.equipment?.name ?? m.externalMachine ?? "machine"}`, subtitle: m.kind, status: m.status })),
    ...inquiries.map((q): TimelineEvent => ({ type: "INQUIRY", id: q.id, date: q.createdAt, reference: q.reference, title: `Demande du site — ${q.productLabel ?? q.type}`, status: q.status })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, TIMELINE_SIZE);

  return {
    customer,
    stats: {
      billedTotal: billed._sum.total ?? 0,
      paidTotal: billed._sum.paidAmount ?? 0,
      outstanding: openInvoices.reduce((s, i) => s + i.total - i.paidAmount, 0),
      openInvoices: openInvoices.length,
      overdueInvoices: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + i.total - i.paidAmount, 0),
      reservations: { total: total(reservationsByStatus), active: count(reservationsByStatus, "EN_ATTENTE", "CONFIRMEE", "EN_COURS") },
      worksites: { total: total(worksitesByStatus), active: count(worksitesByStatus, "PLANIFIE", "EN_COURS") },
      maintenance: maintenanceCount,
      inquiries: inquiryCount,
      customerSince: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
    },
    timeline,
  };
}
