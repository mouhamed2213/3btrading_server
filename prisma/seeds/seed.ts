// Usage : npm run db:seed                    → compte administrateur uniquement
//         SEED_FLEET=true npm run db:seed    → + flotte de démonstration (20 machines par catégorie)
//         SEED_DEMO=true npm run db:seed     → + clients, pièces ET flotte de démonstration
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { seedFleet } from "./seed-fleet.js";
import { seedParts } from "./seed-part.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const u = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL!.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      fullName: "Administrateur",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  console.log(`✔ Admin : ${email}`);

  const demo = process.env.SEED_DEMO === "true";
  if (demo || process.env.SEED_FLEET === "true") await seedFleet(prisma);
  if (demo || process.env.SEED_FLEET === "true") await seedParts(prisma);
  if (!demo) return;

  await prisma.customer.createMany({
    skipDuplicates: true,
    data: [
      {
        name: "Sénégal Bâtiment SA",
        type: "PARTENAIRE",
        paymentTerms: "A_TERME",
        phone: "+221 33 800 00 01",
        ninea: "004512367",
      },
      {
        name: "Générale Travaux",
        type: "ENTREPRISE",
        phone: "+221 33 800 00 02",
      },
      { name: "Mamadou Diop", type: "PARTICULIER", phone: "+221 77 000 00 03" },
      { name: "SOTRACOM", type: "ENTREPRISE", phone: "+221 33 800 00 04" },
    ],
  });

  if ((await prisma.part.count()) === 0) {
    await prisma.part.create({
      data: {
        name: "Filtre hydraulique 1R-0719",
        brand: "Caterpillar",
        family: "FILTRATION",
        oemReference: "1R-0719",
        compatibleModels: ["CAT 320D", "CAT D6R"],
        price: 85_000,
        stockQuantity: 24,
        images: { create: { url: u("photo-1603814744347-31a27ca92271") } },
      },
    });
    await prisma.part.create({
      data: {
        name: "Pompe hydraulique PC200",
        brand: "Komatsu",
        family: "HYDRAULIQUE",
        oemReference: "708-2L-00300",
        compatibleModels: ["PC200"],
        price: 1_850_000,
        stockQuantity: 4,
        warrantyMonths: 6,
        images: { create: { url: u("photo-1652248759121-2edb066a9557") } },
      },
    });
  }
  console.log("✔ Données de démonstration ajoutées");
}

main().finally(() => prisma.$disconnect());
