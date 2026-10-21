import { z } from "zod";
import { InquiryStatus, InquiryType } from "../../generated/prisma/enums.js";
import { paginationQuery } from "../../lib/http.js";

// Formulaires du site public (réservation, contact, demande d'offre)
export const publicInquiryBody = z.object({
  type: z.enum(InquiryType),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  email: z.email().nullish(),
  message: z.string().trim().max(2000).nullish(),
  desiredStartDate: z.coerce.date().nullish(),
  durationRange: z.enum(["1-3", "4-7", "7+"]).nullish(),
  siteLocation: z.string().trim().max(200).nullish(),
  productLabel: z.string().trim().max(200).nullish(),
  equipmentId: z.string().min(1).nullish(),
  partId: z.string().min(1).nullish(),
  website: z.string().max(0).optional(), // champ piège anti-spam : doit rester vide
});

export const updateInquiryBody = z.object({
  status: z.enum(InquiryStatus).optional(),
  internalNote: z.string().trim().nullish(),
});

export const listInquiriesQuery = paginationQuery.extend({
  status: z.enum(InquiryStatus).optional(),
  type: z.enum(InquiryType).optional(),
  customerId: z.string().optional(), // demandes du même téléphone / email que ce client
  q: z.string().trim().optional(),
});
