import type { Tx } from "./prisma.js";

async function next(tx: Tx, key: string) {
  const row = await tx.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

/** RES-2026-001, FAC-2026-014… — atomique (incrément SQL dans la transaction). */
export async function nextReference(tx: Tx, prefix: string) {
  const year = new Date().getUTCFullYear();
  const n = await next(tx, `${prefix}-${year}`);
  return `${prefix}-${year}-${String(n).padStart(3, "0")}`;
}

/** 3BT-0001 */
export async function nextEquipmentCode(tx: Tx) {
  const n = await next(tx, "EQ");
  return `3BT-${String(n).padStart(4, "0")}`;
}
