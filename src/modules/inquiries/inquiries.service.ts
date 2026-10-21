import { prisma } from "../../lib/prisma.js";

/**
 * Les demandes du site public ne sont pas liées à un client (le visiteur n'a pas de compte) :
 * on les rapproche du client par téléphone (9 derniers chiffres, quel que soit le format) ou par email.
 */
export async function inquiryIdsForCustomer(customer: { phone: string; email: string | null }) {
  const tail = customer.phone.replace(/\D/g, "").slice(-9);
  const email = customer.email?.trim().toLowerCase() ?? "";
  const byPhone = tail.length >= 7;
  if (!byPhone && !email) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Inquiry"
    WHERE (${byPhone} AND regexp_replace(phone, '\\D', '', 'g') LIKE ${"%" + tail})
       OR (${email} <> '' AND lower(email) = ${email})`;
  return rows.map((r) => r.id);
}
