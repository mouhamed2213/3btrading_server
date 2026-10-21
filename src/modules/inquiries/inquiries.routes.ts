import { Router } from "express";
import { notFound } from "../../lib/errors.js";
import { idParam, paged, paginate } from "../../lib/http.js";
import { prisma, Prisma } from "../../lib/prisma.js";
import { inquiryIdsForCustomer } from "./inquiries.service.js";
import { listInquiriesQuery, updateInquiryBody } from "./inquiries.schemas.js";

export const inquiriesRouter = Router();

inquiriesRouter.get("/", async (req, res) => {
  const query = listInquiriesQuery.parse(req.query);
  let ids: string[] | undefined;
  if (query.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: query.customerId }, select: { phone: true, email: true } });
    ids = customer ? await inquiryIdsForCustomer(customer) : [];
  }
  const where: Prisma.InquiryWhereInput = {
    ...(ids && { id: { in: ids } }),
    ...(query.status && { status: query.status }),
    ...(query.type && { type: query.type }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { reference: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
      ],
    }),
  };
  const [data, total, newCount] = await Promise.all([
    prisma.inquiry.findMany({ where, orderBy: { createdAt: "desc" }, ...paginate(query) }),
    prisma.inquiry.count({ where }),
    prisma.inquiry.count({ where: { status: "NOUVELLE" } }),
  ]);
  res.json({ ...paged(data, total, query), newCount });
});

inquiriesRouter.get("/:id", async (req, res) => {
  const inquiry = await prisma.inquiry.findUnique({ where: { id: idParam.parse(req.params).id } });
  if (!inquiry) throw notFound("Demande");
  res.json(inquiry);
});

inquiriesRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await prisma.inquiry.update({ where: { id }, data: updateInquiryBody.parse(req.body) }));
});
