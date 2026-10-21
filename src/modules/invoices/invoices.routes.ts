import { Router } from "express";
import { badRequest, notFound } from "../../lib/errors.js";
import { idParam, paged, paginate, startOfDay } from "../../lib/http.js";
import { prisma, Prisma } from "../../lib/prisma.js";
import {
  convertBody,
  createInvoiceBody,
  fromReservationBody,
  fromWorksiteBody,
  listInvoicesQuery,
  listPaymentsQuery,
  paymentBody,
  reminderBody,
} from "./invoices.schemas.js";
import {
  cancelInvoice,
  convertProforma,
  createFromReservation,
  createFromWorksite,
  createInvoice,
  decorate,
  getBillingSummary,
  invoiceDetailInclude,
  recordPayment,
} from "./invoices.service.js";

export const invoicesRouter = Router();
export const paymentsRouter = Router();

const listInclude = { customer: { select: { id: true, name: true } } } satisfies Prisma.InvoiceInclude;

invoicesRouter.get("/", async (req, res) => {
  const query = listInvoicesQuery.parse(req.query);
  const open = query.unpaid || query.overdue;
  const where: Prisma.InvoiceWhereInput = {
    ...(query.type && { type: query.type }),
    ...(query.status && { status: query.status }),
    ...(query.customerId && { customerId: query.customerId }),
    ...(open && { status: { in: ["IMPAYEE", "PARTIELLE"] } }),
    ...(query.overdue && { dueDate: { lt: startOfDay() } }),
    ...((query.from || query.to) && { issueDate: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }),
    ...(query.q && {
      OR: [
        { number: { contains: query.q, mode: "insensitive" } },
        { customer: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({ where, include: listInclude, orderBy: { createdAt: "desc" }, ...paginate(query) }),
    prisma.invoice.count({ where }),
  ]);
  res.json(paged(rows.map(decorate), total, query));
});

invoicesRouter.get("/summary", async (_req, res) => {
  res.json(await getBillingSummary());
});

invoicesRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceDetailInclude });
  if (!invoice) throw notFound("Facture");
  res.json(decorate(invoice));
});

// Création manuelle (lignes libres)
invoicesRouter.post("/", async (req, res) => {
  const body = createInvoiceBody.parse(req.body);
  if (body.reservationId && body.worksiteId) throw badRequest("Une facture se rattache à une réservation OU à un chantier");
  res.status(201).json(await prisma.$transaction((tx) => createInvoice(tx, body)));
});

// Génération automatique : lignes, montants, déduction des acomptes
invoicesRouter.post("/from-reservation", async (req, res) => {
  const { reservationId, ...input } = fromReservationBody.parse(req.body);
  res.status(201).json(await createFromReservation(reservationId, input));
});

invoicesRouter.post("/from-worksite", async (req, res) => {
  const { worksiteId, ...input } = fromWorksiteBody.parse(req.body);
  res.status(201).json(await createFromWorksite(worksiteId, input));
});

invoicesRouter.post("/:id/convert", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.status(201).json(await convertProforma(id, convertBody.parse(req.body)));
});

invoicesRouter.post("/:id/cancel", async (req, res) => {
  res.json(await cancelInvoice(idParam.parse(req.params).id));
});

invoicesRouter.post("/:id/payments", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.status(201).json(await recordPayment(id, paymentBody.parse(req.body)));
});

// Suivi des impayés : historique des relances
invoicesRouter.post("/:id/reminders", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = reminderBody.parse(req.body);
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!invoice) throw notFound("Facture");
  if (invoice.status !== "IMPAYEE" && invoice.status !== "PARTIELLE") throw badRequest("Seules les factures impayées peuvent être relancées");
  res.status(201).json(await prisma.invoiceReminder.create({ data: { ...body, invoiceId: id } }));
});

// ───────────── Paiements / reçus ─────────────

paymentsRouter.get("/", async (req, res) => {
  const query = listPaymentsQuery.parse(req.query);
  const where: Prisma.PaymentWhereInput = {
    ...(query.method && { method: query.method }),
    ...(query.customerId && { invoice: { customerId: query.customerId } }),
    ...((query.from || query.to) && { paidAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }),
  };
  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { invoice: { select: { number: true, type: true, customer: { select: { id: true, name: true } } } } },
      orderBy: { paidAt: "desc" },
      ...paginate(query),
    }),
    prisma.payment.count({ where }),
  ]);
  res.json(paged(data, total, query));
});

// Données du reçu de paiement (à imprimer côté frontend)
paymentsRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { invoice: { include: { customer: { select: { name: true, ninea: true, address: true, phone: true } } } } },
  });
  if (!payment) throw notFound("Paiement");
  res.json({ ...payment, remainingBalance: payment.invoice.total - payment.invoice.paidAmount });
});
