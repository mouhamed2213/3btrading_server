import { Router } from "express";
import { badRequest, notFound } from "../../lib/errors.js";
import { idParam, paged, paginate } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { requireRole } from "../../middlewares/auth.js";
import { createCustomerBody, listCustomersQuery, updateCustomerBody } from "./customers.schemas.js";
import { getCustomerOverview } from "./customers.service.js";

export const customersRouter = Router();

customersRouter.get("/", async (req, res) => {
  const query = listCustomersQuery.parse(req.query);
  const where = {
    ...(query.type && { type: query.type }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: "insensitive" as const } },
        { phone: { contains: query.q } },
        { ninea: { contains: query.q, mode: "insensitive" as const } },
      ],
    }),
  };
  const [data, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { name: "asc" }, ...paginate(query) }),
    prisma.customer.count({ where }),
  ]);
  res.json(paged(data, total, query));
});

// Dossier client : indicateurs et historique de toutes les activités du client
customersRouter.get("/:id/overview", async (req, res) => {
  res.json(await getCustomerOverview(idParam.parse(req.params).id));
});

customersRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw notFound("Client");
  // Encours : solde restant dû sur les factures ouvertes
  const open = await prisma.invoice.findMany({
    where: { customerId: id, status: { in: ["IMPAYEE", "PARTIELLE"] } },
    select: { total: true, paidAmount: true },
  });
  const outstanding = open.reduce((sum, i) => sum + (i.total - i.paidAmount), 0);
  res.json({ ...customer, outstanding, openInvoices: open.length });
});

customersRouter.post("/", async (req, res) => {
  const data = createCustomerBody.parse(req.body);
  res.status(201).json(await prisma.customer.create({ data }));
});

customersRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = updateCustomerBody.parse(req.body);
  const current = await prisma.customer.findUnique({ where: { id } });
  if (!current) throw notFound("Client");
  const type = data.type ?? current.type;
  const terms = data.paymentTerms ?? current.paymentTerms;
  if (terms === "A_TERME" && type !== "PARTENAIRE") throw badRequest("Le paiement à terme est réservé aux partenaires");
  res.json(await prisma.customer.update({ where: { id }, data }));
});

// Échoue (409) si le client a des réservations, chantiers ou factures.
customersRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const { id } = idParam.parse(req.params);
  await prisma.customer.delete({ where: { id } });
  res.status(204).end();
});
