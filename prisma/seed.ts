// Usage : npm run db:seed            → crée le compte administrateur
//         SEED_DEMO=true npm run db:seed → + données de démonstration (reprises du frontend)
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@3btrading.sn").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, fullName: "Administrateur", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`✔ Admin : ${email}`);

  if (process.env.SEED_DEMO !== "true") return;

  await prisma.customer.createMany({
    skipDuplicates: true,
    data: [
      { name: "Sénégal Bâtiment SA", type: "PARTENAIRE", paymentTerms: "A_TERME", phone: "+221 33 800 00 01", ninea: "004512367" },
      { name: "Générale Travaux", type: "ENTREPRISE", phone: "+221 33 800 00 02" },
      { name: "Mamadou Diop", type: "PARTICULIER", phone: "+221 77 000 00 03" },
      { name: "SOTRACOM", type: "ENTREPRISE", phone: "+221 33 800 00 04" },
    ],
  });

  const equipment = [
    { code: "3BT-0001", name: "Pelle hydraulique CAT 320D", category: "PELLE_HYDRAULIQUE", brand: "Caterpillar", model: "320D", year: 2022, meterValue: 2840, powerHp: 165, dailyRate: 550000, degressiveDailyRate: 480000, isForSale: true, salePrice: 145_000_000, img: "photo-1580901369227-308f6f40bdeb" },
    { code: "3BT-0002", name: "Camion benne 6×4", category: "CAMION", brand: "Mercedes-Benz", model: "Actros", year: 2021, meterValue: 45200, meterUnit: "KM", powerHp: 430, dailyRate: 120000, rotationRate: 45000, isForSale: true, salePrice: 68_500_000, img: "photo-1622645636770-11fbf0611463" },
    { code: "3BT-0003", name: "Chargeuse sur pneus WA320", category: "CHARGEUR_TRACTOPELLE", brand: "Komatsu", model: "WA320", year: 2020, meterValue: 4120, powerHp: 150, dailyRate: 350000, degressiveDailyRate: 300000, isForSale: true, salePrice: 92_000_000, img: "photo-1580901368813-93220b510345" },
    { code: "3BT-0004", name: "Bulldozer D6R", category: "BULLDOZER", brand: "Caterpillar", model: "D6R", year: 2019, meterValue: 5650, powerHp: 185, dailyRate: 600000, degressiveDailyRate: 520000, isForSale: true, salePrice: 120_000_000, img: "photo-1603814744450-36f978490b11" },
  ] as const;
  for (const { img, ...e } of equipment) {
    await prisma.equipment.upsert({
      where: { code: e.code },
      update: {},
      create: { ...e, isRentable: true, isPublished: true, images: { create: { url: u(img), position: 0 } } },
    });
  }
  await prisma.sequence.upsert({ where: { key: "EQ" }, update: {}, create: { key: "EQ", value: equipment.length } });

  if ((await prisma.part.count()) === 0) {
    await prisma.part.create({ data: { name: "Filtre hydraulique 1R-0719", brand: "Caterpillar", family: "FILTRATION", oemReference: "1R-0719", compatibleModels: ["CAT 320D", "CAT D6R"], price: 85_000, stockQuantity: 24, images: { create: { url: u("photo-1603814744347-31a27ca92271") } } } });
    await prisma.part.create({ data: { name: "Pompe hydraulique PC200", brand: "Komatsu", family: "HYDRAULIQUE", oemReference: "708-2L-00300", compatibleModels: ["PC200"], price: 1_850_000, stockQuantity: 4, warrantyMonths: 6, images: { create: { url: u("photo-1652248759121-2edb066a9557") } } } });
  }
  console.log("✔ Données de démonstration ajoutées");
}

main().finally(() => prisma.$disconnect());
