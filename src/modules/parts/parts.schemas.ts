import { z } from "zod";
import { PartCondition, PartFamily } from "../../generated/prisma/enums.js";
import { fcfa, paginationQuery } from "../../lib/http.js";

const fields = z.object({
  name: z.string().trim().min(2),
  brand: z.string().trim().min(1),
  family: z.enum(PartFamily),
  oemReference: z.string().trim().min(1).nullish(),
  compatibleModels: z.array(z.string().trim().min(1)).default([]),
  condition: z.enum(PartCondition).default("NEUF"),
  isOriginal: z.boolean().default(true),
  price: fcfa,
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(2),
  warrantyMonths: z.number().int().min(0).nullish(),
  description: z.string().trim().nullish(),
  isPublished: z.boolean().default(true),
});

export const createPartBody = fields;
export const updatePartBody = fields.partial();

export const listPartsQuery = paginationQuery.extend({
  q: z.string().trim().optional(), // nom, marque, référence OEM
  brand: z.string().trim().optional(),
  family: z.enum(PartFamily).optional(),
  oem: z.string().trim().optional(),
  compatibleWith: z.string().trim().optional(), // modèle d'engin
  lowStock: z.stringbool().optional(),
  inStock: z.stringbool().optional(),
});

export const stockBody = z.object({ delta: z.number().int().refine((n) => n !== 0, "delta ne peut pas être 0") });
