import { z } from "zod";
import { WorkType, WorksitePricing, WorksiteStatus } from "../../generated/prisma/enums.js";
import { fcfa, paginationQuery } from "../../lib/http.js";

const fields = z.object({
  name: z.string().trim().min(2),
  customerId: z.string().min(1),
  location: z.string().trim().min(2),
  workType: z.enum(WorkType),
  pricing: z.enum(WorksitePricing),
  // FORFAIT : prix global · VOLUME : prix par m³ · HORAIRE : prix par heure · JOURNEE : prix par jour
  unitPrice: fcfa,
  estimatedQuantity: z.number().positive().nullish(),
  budget: fcfa.nullish(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullish(),
  notes: z.string().trim().nullish(),
});

export const createWorksiteBody = fields;
export const updateWorksiteBody = fields.partial().extend({ status: z.enum(WorksiteStatus).optional() });

export const entryBody = z.object({
  date: z.coerce.date(),
  quantity: z.number().positive(), // m³, heures ou jours selon le mode de tarification
  equipmentId: z.string().min(1).nullish(),
  notes: z.string().trim().nullish(),
});

export const listWorksitesQuery = paginationQuery.extend({
  status: z.enum(WorksiteStatus).optional(),
  customerId: z.string().optional(),
  q: z.string().trim().optional(),
});
