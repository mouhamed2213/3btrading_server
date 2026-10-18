import { prisma, Prisma } from "../../lib/prisma.js";
import type { z } from "zod";
import type { listPartsQuery } from "./parts.schemas.js";

/** Filtres de recherche : marque, famille, compatibilité, référence OEM (+ texte libre). Partagé admin / site public. */
export function partsWhere(query: z.infer<typeof listPartsQuery>): Prisma.PartWhereInput {
  return {
    ...(query.brand && { brand: { equals: query.brand, mode: "insensitive" } }),
    ...(query.family && { family: query.family }),
    ...(query.oem && { oemReference: { contains: query.oem, mode: "insensitive" } }),
    ...(query.compatibleWith && { compatibleModels: { has: query.compatibleWith } }),
    ...(query.inStock && { stockQuantity: { gt: 0 } }),
    // Stock faible : quantité <= seuil propre à chaque pièce
    ...(query.lowStock && { stockQuantity: { lte: prisma.part.fields.lowStockThreshold } }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { brand: { contains: query.q, mode: "insensitive" } },
        { oemReference: { contains: query.q, mode: "insensitive" } },
        { compatibleModels: { has: query.q } },
      ],
    }),
  };
}
