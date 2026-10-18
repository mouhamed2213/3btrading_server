import { z } from "zod";

export const idParam = z.object({ id: z.string().min(1) });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function paginate({ page, limit }: { page: number; limit: number }) {
  return { skip: (page - 1) * limit, take: limit };
}

export function paged<T>(data: T[], total: number, { page, limit }: { page: number; limit: number }) {
  return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

// Dates "YYYY-MM-DD" ou ISO → Date
export const dateField = z.coerce.date();
export const fcfa = z.number().int().min(0);

export const startOfDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
