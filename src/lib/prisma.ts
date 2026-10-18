import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { Prisma, PrismaClient } from "../generated/prisma/client.js";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

export type Tx = Prisma.TransactionClient;
export { Prisma };
