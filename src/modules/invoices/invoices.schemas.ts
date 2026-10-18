import { z } from "zod";
import { InvoiceCategory, InvoiceStatus, InvoiceType, PaymentMethod, ReminderChannel } from "../../generated/prisma/enums.js";
import { fcfa, paginationQuery } from "../../lib/http.js";

export const lineBody = z
  .object({
    label: z.string().trim().min(1),
    quantity: z.number().int().min(1),
    unitPrice: fcfa,
    partId: z.string().min(1).nullish(), // vente de pièce : décompte le stock à la facture définitive
    equipmentId: z.string().min(1).nullish(), // vente d'engin : passe l'engin en VENDU à la facture définitive
  })
  .refine((l) => !(l.partId && l.equipmentId), { message: "Une ligne ne peut pas viser à la fois une pièce et un engin" })
  .refine((l) => !l.equipmentId || l.quantity === 1, { message: "Un engin se vend à l'unité (quantité = 1)", path: ["quantity"] });

export const createInvoiceBody = z.object({
  type: z.enum(InvoiceType),
  customerId: z.string().min(1),
  category: z.enum(InvoiceCategory).optional(), // déduite de reservationId / worksiteId, sinon VENTE
  reservationId: z.string().min(1).nullish(),
  worksiteId: z.string().min(1).nullish(),
  dueDate: z.coerce.date(),
  taxRate: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().nullish(),
  lines: z.array(lineBody).min(1),
});

// Génération automatique depuis une réservation ou un chantier
const source = {
  type: z.enum(InvoiceType),
  amount: fcfa.optional(), // montant HT de l'acompte
  dueDate: z.coerce.date().optional(),
};
export const fromReservationBody = z.object({ reservationId: z.string().min(1), ...source });
export const fromWorksiteBody = z.object({ worksiteId: z.string().min(1), ...source });

export const convertBody = z.object({
  type: z.enum(["ACOMPTE", "DEFINITIVE"]),
  amount: fcfa.optional(),
  dueDate: z.coerce.date().optional(),
});

export const paymentBody = z
  .object({
    amount: z.number().int().positive(),
    method: z.enum(PaymentMethod),
    transactionRef: z.string().trim().min(1).nullish(),
    paidAt: z.coerce.date().optional(),
    notes: z.string().trim().nullish(),
  })
  .refine((p) => p.method === "ESPECES" || !!p.transactionRef, {
    message: "La référence de transaction est requise pour un paiement mobile",
    path: ["transactionRef"],
  });

export const reminderBody = z.object({ channel: z.enum(ReminderChannel), note: z.string().trim().nullish() });

export const listInvoicesQuery = paginationQuery.extend({
  type: z.enum(InvoiceType).optional(),
  status: z.enum(InvoiceStatus).optional(),
  customerId: z.string().optional(),
  unpaid: z.stringbool().optional(), // IMPAYEE + PARTIELLE
  overdue: z.stringbool().optional(), // impayées dont l'échéance est dépassée
  q: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const listPaymentsQuery = paginationQuery.extend({
  method: z.enum(PaymentMethod).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
