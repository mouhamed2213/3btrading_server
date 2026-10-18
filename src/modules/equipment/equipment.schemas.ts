import { z } from "zod";
import { EquipmentCategory, EquipmentStatus, MeterUnit } from "../../generated/prisma/enums.js";
import { fcfa, paginationQuery } from "../../lib/http.js";

const fields = z.object({
  name: z.string().trim().min(2),
  category: z.enum(EquipmentCategory),
  brand: z.string().trim().min(1),
  model: z.string().trim().nullish(),
  year: z.number().int().min(1950).max(2100).nullish(),
  serialNumber: z.string().trim().min(1).nullish(),
  meterValue: z.number().int().min(0).default(0),
  meterUnit: z.enum(MeterUnit).default("HEURES"),
  powerHp: z.number().int().positive().nullish(),
  location: z.string().trim().min(1).default("Dakar"),
  description: z.string().trim().nullish(),
  // L'état EN_LOCATION est piloté par les réservations ; VENDU par la facture de vente.
  status: z.enum(["DISPONIBLE", "MAINTENANCE", "VENDU"]).default("DISPONIBLE"),
  isRentable: z.boolean().default(true),
  dailyRate: fcfa.nullish(),
  rotationRate: fcfa.nullish(),
  degressiveFromDays: z.number().int().min(2).default(7),
  degressiveDailyRate: fcfa.nullish(),
  isForSale: z.boolean().default(false),
  salePrice: fcfa.nullish(),
  isPublished: z.boolean().default(false),
});

export const createEquipmentBody = fields;
export const updateEquipmentBody = fields.partial();
export type EquipmentInput = z.infer<typeof fields>;

export const listEquipmentQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  category: z.enum(EquipmentCategory).optional(),
  status: z.enum(EquipmentStatus).optional(),
  brand: z.string().trim().optional(),
  isForSale: z.stringbool().optional(),
  isRentable: z.stringbool().optional(),
});

export const availabilityQuery = z
  .object({ from: z.coerce.date(), to: z.coerce.date() })
  .refine((v) => v.to >= v.from, { message: "'to' doit être postérieure à 'from'", path: ["to"] });
