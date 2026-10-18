import { z } from "zod";
import { CustomerType, PaymentTerms } from "../../generated/prisma/enums.js";
import { paginationQuery } from "../../lib/http.js";

const base = z.object({
  name: z.string().trim().min(2),
  type: z.enum(CustomerType).default("ENTREPRISE"),
  paymentTerms: z.enum(PaymentTerms).default("COMPTANT"),
  phone: z.string().trim().min(6),
  email: z.email().nullish(),
  ninea: z.string().trim().nullish(),
  address: z.string().trim().nullish(),
  notes: z.string().trim().nullish(),
});

// Le paiement à terme (facturation fin de mois) est réservé aux partenaires.
export const createCustomerBody = base.refine((c) => c.paymentTerms === "COMPTANT" || c.type === "PARTENAIRE", {
  message: "Le paiement à terme est réservé aux clients de type PARTENAIRE",
  path: ["paymentTerms"],
});
export const updateCustomerBody = base.partial();

export const listCustomersQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  type: z.enum(CustomerType).optional(),
});
