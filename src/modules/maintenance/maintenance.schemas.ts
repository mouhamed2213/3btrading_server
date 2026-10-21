import { z } from "zod";
import { MaintenanceKind, MaintenanceStatus, MaintenanceType } from "../../generated/prisma/enums.js";
import { fcfa, paginationQuery } from "../../lib/http.js";

export const createMaintenanceBody = z
  .object({
    kind: z.enum(MaintenanceKind),
    type: z.enum(MaintenanceType),
    equipmentId: z.string().min(1).nullish(), // flotte (INTERNE) ou engin vendu (SAV)
    customerId: z.string().min(1).nullish(), // REPARATION_CLIENT et SAV
    externalMachine: z.string().trim().min(1).nullish(), // machine d'un client externe
    scheduledDate: z.coerce.date(),
    technician: z.string().trim().nullish(),
    meterReading: z.number().int().min(0).nullish(),
    estimatedCost: fcfa.nullish(),
    description: z.string().trim().nullish(),
  })
  .superRefine((m, ctx) => {
    const need = (ok: unknown, path: string, message: string) => !ok && ctx.addIssue({ code: "custom", path: [path], message });
    if (m.kind === "INTERNE") need(m.equipmentId, "equipmentId", "Engin requis pour un entretien interne");
    if (m.kind === "REPARATION_CLIENT") {
      need(m.customerId, "customerId", "Client requis pour une réparation externe");
      need(m.externalMachine, "externalMachine", "Machine du client requise");
    }
    if (m.kind === "SAV") {
      need(m.equipmentId, "equipmentId", "Engin requis pour le SAV");
      need(m.customerId, "customerId", "Client requis pour le SAV");
    }
  });

export const updateMaintenanceBody = z.object({
  scheduledDate: z.coerce.date().optional(),
  technician: z.string().trim().nullish(),
  estimatedCost: fcfa.nullish(),
  description: z.string().trim().nullish(),
});

export const completeMaintenanceBody = z.object({
  actualCost: fcfa.optional(),
  meterReading: z.number().int().min(0).optional(),
  description: z.string().trim().optional(),
});

export const listMaintenanceQuery = paginationQuery.extend({
  status: z.enum(MaintenanceStatus).optional(),
  kind: z.enum(MaintenanceKind).optional(),
  equipmentId: z.string().optional(),
  customerId: z.string().optional(),
  q: z.string().trim().optional(),
});
