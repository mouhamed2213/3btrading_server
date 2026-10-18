import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { getBillingSummary } from "../invoices/invoices.service.js";

export const dashboardRouter = Router();

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

dashboardRouter.get("/", async (_req, res) => {
  const now = new Date();
  // 6 derniers mois, du plus ancien au mois courant
  const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1)));

  const [payments, fleet, activeReservations, pendingReservations, recentReservations, billing, newInquiries, lowStock, plannedMaintenance] =
    await Promise.all([
      prisma.payment.findMany({
        where: { paidAt: { gte: months[0]! } },
        select: { amount: true, paidAt: true, invoice: { select: { category: true } } },
      }),
      prisma.equipment.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.reservation.count({ where: { status: { in: ["CONFIRMEE", "EN_COURS"] } } }),
      prisma.reservation.count({ where: { status: "EN_ATTENTE" } }),
      prisma.reservation.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { customer: { select: { id: true, name: true } }, equipment: { select: { id: true, code: true, name: true } } },
      }),
      getBillingSummary(),
      prisma.inquiry.count({ where: { status: "NOUVELLE" } }),
      prisma.part.count({ where: { stockQuantity: { lte: prisma.part.fields.lowStockThreshold } } }),
      prisma.maintenanceOrder.count({ where: { status: "PLANIFIEE" } }),
    ]);

  // Encaissements par mois : « services » (locations + chantiers) vs « ventes »
  const revenueByMonth = months.map((m) => ({ month: monthKey(m), services: 0, ventes: 0 }));
  for (const p of payments) {
    const row = revenueByMonth.find((r) => r.month === monthKey(p.paidAt));
    if (row) p.invoice.category === "VENTE" ? (row.ventes += p.amount) : (row.services += p.amount);
  }
  const current = revenueByMonth[5]!;
  const previous = revenueByMonth[4]!;
  const currentTotal = current.services + current.ventes;
  const previousTotal = previous.services + previous.ventes;

  const count = (s: string) => fleet.find((f) => f.status === s)?._count._all ?? 0;
  const inFleet = count("DISPONIBLE") + count("EN_LOCATION") + count("MAINTENANCE"); // les engins vendus ne comptent plus

  res.json({
    kpis: {
      revenueThisMonth: currentTotal,
      revenueGrowthPct: previousTotal > 0 ? Math.round(((currentTotal - previousTotal) / previousTotal) * 1000) / 10 : null,
      activeReservations,
      pendingReservations,
      availableEquipment: count("DISPONIBLE"),
      totalEquipment: inFleet,
      unpaidAmount: billing.unpaidAmount,
      unpaidCount: billing.unpaidCount,
      overdueCount: billing.overdueCount,
    },
    fleet: {
      total: inFleet,
      DISPONIBLE: count("DISPONIBLE"),
      EN_LOCATION: count("EN_LOCATION"),
      MAINTENANCE: count("MAINTENANCE"),
      availablePct: inFleet ? Math.round((count("DISPONIBLE") / inFleet) * 100) : 0,
    },
    revenueByMonth,
    recentReservations,
    alerts: { newInquiries, lowStockParts: lowStock, plannedMaintenance },
  });
});
