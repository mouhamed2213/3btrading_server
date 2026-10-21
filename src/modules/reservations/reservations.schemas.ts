import { z } from "zod";
import {
  RentalPricing,
  ReservationStatus,
} from "../../generated/prisma/enums.js";
import { paginationQuery } from "../../lib/http.js";

const dates = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const createReservationBody = dates
  .extend({
    customerId: z.string().min(1),
    equipmentId: z.string().min(1),
    pricing: z.enum(RentalPricing).default("JOURNALIER"),
    rotations: z.number().int().min(1).nullish(), // requis si pricing = ROTATION
    siteLocation: z.string().trim().nullish(),
    operatorName: z.string().trim().nullish(),
    notes: z.string().trim().nullish(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "La date de fin précède la date de début",
    path: ["endDate"],
  });

export const updateReservationBody = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  pricing: z.enum(RentalPricing).optional(),
  rotations: z.number().int().min(1).nullish(),
  siteLocation: z.string().trim().nullish(),
  operatorName: z.string().trim().nullish(),
  notes: z.string().trim().nullish(),
});

export const completeBody = z.object({
  meterValue: z.number().int().min(0).optional(),
});

export const listReservationsQuery = paginationQuery.extend({
  status: z.enum(ReservationStatus).optional(),
  equipmentId: z.string().optional(),
  customerId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().optional(),
});
