import { prisma, type Tx } from "../../lib/prisma.js";

export const QUANTITY_UNIT = { FORFAIT: "forfait", VOLUME: "m³", HORAIRE: "h", JOURNEE: "jour(s)" } as const;

/** Montant HT réalisé à date : forfait = prix global, sinon prix unitaire × quantité cumulée. */
export function worksiteAmount(w: { pricing: keyof typeof QUANTITY_UNIT; unitPrice: number }, totalQuantity: number) {
  return w.pricing === "FORFAIT" ? w.unitPrice : Math.round(w.unitPrice * totalQuantity);
}

export async function totalQuantity(worksiteId: string, db: Tx | typeof prisma = prisma) {
  const { _sum } = await db.worksiteEntry.aggregate({ where: { worksiteId }, _sum: { quantity: true } });
  return _sum.quantity ?? 0;
}
