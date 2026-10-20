// Flotte de démonstration : 20 machines par catégorie (100 au total).
// Idempotent : une machine est identifiée par son n° de série et n'est jamais créée deux fois.
import type { PrismaClient } from "../generated/prisma/client.js";

type Category =
  | "PELLE_HYDRAULIQUE"
  | "CHARGEUR_TRACTOPELLE"
  | "BULLDOZER"
  | "MINI_PELLE_COMPACTEUR"
  | "CAMION";
// [type, marque, modèle, puissance (ch), tarif/jour en milliers de FCFA, prix neuf de référence en millions de FCFA, tarif/rotation en milliers (camions)]
type Row = [string, string, string, number, number, number, number?];

const FLEET: Record<Category, Row[]> = {
  PELLE_HYDRAULIQUE: [
    ["Pelle hydraulique", "Caterpillar", "320D", 165, 550, 145],
    ["Pelle hydraulique", "Caterpillar", "320GC", 162, 580, 160],
    ["Pelle hydraulique", "Caterpillar", "323D", 175, 600, 150],
    ["Pelle hydraulique", "Caterpillar", "330D", 270, 720, 185],
    ["Pelle hydraulique", "Komatsu", "PC200-8", 148, 520, 125],
    ["Pelle hydraulique", "Komatsu", "PC210-10", 158, 560, 140],
    ["Pelle hydraulique", "Komatsu", "PC300-8", 247, 700, 175],
    ["Pelle hydraulique", "Komatsu", "PC350-8", 257, 740, 190],
    ["Pelle hydraulique", "Hitachi", "ZX200-5G", 148, 510, 120],
    ["Pelle hydraulique", "Hitachi", "ZX210LC-5", 158, 540, 135],
    ["Pelle hydraulique", "Hitachi", "ZX350LC-5", 270, 730, 180],
    ["Pelle hydraulique", "Volvo", "EC210D", 170, 560, 140],
    ["Pelle hydraulique", "Volvo", "EC250D", 190, 620, 155],
    ["Pelle hydraulique", "Volvo", "EC300D", 250, 700, 170],
    ["Pelle hydraulique", "Hyundai", "R210LC-9", 158, 500, 110],
    ["Pelle hydraulique", "Hyundai", "R250LC-9", 188, 560, 130],
    ["Pelle hydraulique", "Doosan", "DX225LC", 160, 500, 115],
    ["Pelle hydraulique", "JCB", "JS220", 165, 520, 120],
    ["Pelle hydraulique", "Kobelco", "SK210LC", 158, 540, 130],
    ["Pelle hydraulique", "Sany", "SY215C", 154, 450, 85],
  ],
  CHARGEUR_TRACTOPELLE: [
    ["Chargeuse sur pneus", "Caterpillar", "950GC", 215, 480, 115],
    ["Chargeuse sur pneus", "Caterpillar", "966H", 270, 560, 130],
    ["Tractopelle", "Caterpillar", "428F", 100, 320, 70],
    ["Tractopelle", "Caterpillar", "432F", 110, 340, 75],
    ["Chargeuse sur pneus", "Komatsu", "WA320-6", 150, 400, 92],
    ["Chargeuse sur pneus", "Komatsu", "WA380-8", 205, 470, 108],
    ["Chargeuse sur pneus", "Komatsu", "WA470-8", 270, 560, 125],
    ["Tractopelle", "JCB", "3CX", 92, 300, 62],
    ["Tractopelle", "JCB", "4CX", 100, 320, 68],
    ["Tractopelle", "JCB", "5CX", 109, 340, 72],
    ["Chargeuse sur pneus", "Volvo", "L90H", 190, 430, 98],
    ["Chargeuse sur pneus", "Volvo", "L120H", 260, 520, 118],
    ["Tractopelle", "Case", "580ST", 97, 300, 58],
    ["Tractopelle", "Case", "590SN", 103, 320, 64],
    ["Chargeuse sur pneus", "Hyundai", "HL940", 190, 420, 92],
    ["Chargeuse sur pneus", "Liebherr", "L550", 200, 450, 105],
    ["Chargeuse sur pneus", "Doosan", "DL250", 170, 400, 85],
    ["Chargeuse sur pneus", "XCMG", "LW500FN", 125, 330, 55],
    ["Chargeuse sur pneus", "Sany", "SW405K", 125, 320, 52],
    ["Chargeuse sur pneus", "LiuGong", "856H", 162, 380, 65],
  ],
  BULLDOZER: [
    ["Bulldozer", "Caterpillar", "D5K", 130, 560, 90],
    ["Bulldozer", "Caterpillar", "D6R", 185, 600, 120],
    ["Bulldozer", "Caterpillar", "D6T", 215, 650, 135],
    ["Bulldozer", "Caterpillar", "D7R", 240, 720, 155],
    ["Bulldozer", "Caterpillar", "D8R", 310, 820, 190],
    ["Bulldozer", "Caterpillar", "D8T", 310, 850, 210],
    ["Bulldozer", "Caterpillar", "D9T", 410, 950, 250],
    ["Bulldozer", "Komatsu", "D51EX", 130, 540, 85],
    ["Bulldozer", "Komatsu", "D65EX-16", 205, 640, 135],
    ["Bulldozer", "Komatsu", "D85EX-15", 264, 750, 165],
    ["Bulldozer", "Komatsu", "D155AX-6", 354, 880, 215],
    ["Bulldozer", "Liebherr", "PR 736", 175, 620, 125],
    ["Bulldozer", "Liebherr", "PR 746", 235, 700, 150],
    ["Bulldozer", "Case", "1650M", 135, 540, 88],
    ["Bulldozer", "Case", "2050M", 190, 620, 115],
    ["Bulldozer", "John Deere", "750K", 160, 580, 100],
    ["Bulldozer", "John Deere", "850K", 215, 660, 130],
    ["Bulldozer", "Shantui", "SD16", 160, 480, 70],
    ["Bulldozer", "Shantui", "SD22", 220, 560, 90],
    ["Bulldozer", "XCMG", "TY180", 180, 500, 75],
  ],
  MINI_PELLE_COMPACTEUR: [
    ["Mini-pelle", "Bobcat", "E35", 35, 220, 22],
    ["Mini-pelle", "Bobcat", "E55", 55, 260, 30],
    ["Mini-pelle", "Bobcat", "E85", 85, 320, 40],
    ["Mini-pelle", "Kubota", "KX040-4", 40, 230, 24],
    ["Mini-pelle", "Kubota", "KX080-4", 70, 280, 34],
    ["Mini-pelle", "Kubota", "U27-4", 24, 200, 18],
    ["Mini-pelle", "Caterpillar", "303.5E2", 40, 230, 25],
    ["Mini-pelle", "Caterpillar", "308 CR", 70, 300, 38],
    ["Mini-pelle", "Takeuchi", "TB235", 35, 220, 21],
    ["Mini-pelle", "Takeuchi", "TB290", 90, 330, 42],
    ["Compacteur", "Bomag", "BW 120 AD", 40, 200, 20],
    ["Compacteur", "Bomag", "BW 213 D-5", 110, 260, 36],
    ["Compacteur", "Bomag", "BW 211 D-40", 103, 250, 34],
    ["Compacteur", "Dynapac", "CA2500D", 97, 250, 33],
    ["Compacteur", "Dynapac", "CA250D", 110, 260, 35],
    ["Compacteur", "Hamm", "3411", 129, 280, 40],
    ["Compacteur", "Hamm", "HD 12 VV", 25, 190, 17],
    ["Compacteur", "Volvo", "SD115", 130, 290, 45],
    ["Mini-pelle", "Volvo", "ECR58", 55, 260, 31],
    ["Mini-pelle", "Wacker Neuson", "ET42", 40, 220, 23],
  ],
  CAMION: [
    ["Camion benne 6×4", "Mercedes-Benz", "Actros 3340", 401, 150, 58, 45],
    ["Camion benne 6×4", "Mercedes-Benz", "Actros 3341", 410, 155, 62, 46],
    ["Camion benne 6×4", "Mercedes-Benz", "Arocs 3345", 450, 170, 72, 50],
    ["Camion benne 8×4", "Mercedes-Benz", "Arocs 4145", 450, 190, 85, 58],
    ["Camion benne 6×4", "MAN", "TGS 33.400", 400, 150, 55, 44],
    ["Camion benne 8×4", "MAN", "TGS 41.440", 440, 185, 80, 56],
    ["Camion benne 6×4", "MAN", "TGA 33.410", 410, 140, 45, 42],
    ["Camion benne 6×4", "Volvo", "FMX 410", 410, 165, 70, 48],
    ["Camion benne 8×4", "Volvo", "FMX 460", 460, 195, 88, 58],
    ["Camion benne 6×4", "Volvo", "FH 460", 460, 170, 75, 50],
    ["Camion benne 6×4", "Scania", "P410", 410, 150, 60, 45],
    ["Camion benne 6×4", "Scania", "G450", 450, 165, 68, 48],
    ["Camion benne 8×4", "Scania", "R500", 500, 195, 90, 58],
    ["Camion benne 6×4", "Renault", "Kerax 450", 450, 150, 52, 44],
    ["Camion benne 6×4", "Iveco", "Trakker 410", 410, 140, 48, 42],
    ["Camion benne 6×4", "Iveco", "Stralis 480", 480, 160, 64, 47],
    ["Camion benne 6×4", "Sinotruk", "Howo 371", 371, 110, 32, 36],
    ["Camion benne 8×4", "Sinotruk", "Howo A7 420", 420, 125, 40, 38],
    ["Camion benne 6×4", "Shacman", "F3000", 380, 115, 34, 36],
    ["Camion benne 6×4", "FAW", "J5P 420", 420, 120, 38, 37],
  ],
};

const u = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;
const PHOTOS: Record<Category, string[]> = {
  PELLE_HYDRAULIQUE: [
    "photo-1580901369227-308f6f40bdeb",
    "photo-1583024011792-b165975b52f5",
  ],
  CHARGEUR_TRACTOPELLE: [
    "photo-1580901368813-93220b510345",
    "photo-1603814744174-115311ad645e",
  ],
  BULLDOZER: [
    "photo-1603814744450-36f978490b11",
    "photo-1575281923032-f40d94ef6160",
  ],
  MINI_PELLE_COMPACTEUR: [
    "photo-1597974385058-66a931a50a7a",
    "photo-1583024011792-b165975b52f5",
  ],
  CAMION: [
    "photo-1622645636770-11fbf0611463",
    "photo-1653924333410-0dda83ae490c",
    "photo-1523660778745-247ed0bcce31",
  ],
};
const SITES = ["Dakar", "Diamniadio", "Thiès", "Mbour", "Kaolack"];
const THIS_YEAR = 2026;
const round = (n: number, step: number) => Math.round(n / step) * step;

export async function seedFleet(prisma: PrismaClient) {
  let created = 0;
  let catIndex = 0;
  for (const [category, rows] of Object.entries(FLEET) as [Category, Row[]][]) {
    for (const [
      i,
      [kind, brand, model, hp, dailyK, newPriceM, rotationK],
    ] of rows.entries()) {
      const year = 2014 + ((i * 7 + catIndex) % 11); // 2014 → 2024, répartition déterministe
      const age = THIS_YEAR - year;
      const isTruck = category === "CAMION";
      const serialNumber =
        `3BT-${category.slice(0, 3)}-${String(i + 1).padStart(2, "0")}-${brand.slice(0, 3).toUpperCase()}${model.replace(/\W/g, "")}`.toUpperCase();
      if (
        await prisma.equipment.findUnique({
          where: { serialNumber },
          select: { id: true },
        })
      )
        continue;

      const isForSale = i % 3 !== 0; // ~13 machines sur 20 sont à vendre
      const isRentable = !(isForSale && i % 4 === 3); // quelques machines uniquement à vendre
      const dailyRate = dailyK * 1000;
      const photos = PHOTOS[category];

      await prisma.$transaction(async (tx) => {
        const seq = await tx.sequence.upsert({
          where: { key: "EQ" },
          create: { key: "EQ", value: 1 },
          update: { value: { increment: 1 } },
        });
        await tx.equipment.create({
          data: {
            code: `3BT-${String(seq.value).padStart(4, "0")}`,
            name: `${kind} ${brand} ${model}`,
            category,
            brand,
            model,
            year,
            serialNumber,
            powerHp: hp,
            meterUnit: isTruck ? "KM" : "HEURES",
            meterValue: isTruck
              ? age * 26_000 + ((i * 3_700) % 18_000)
              : Math.max(150, age * 620 + ((i * 173) % 700)),
            location: SITES[(i + catIndex) % SITES.length]!,
            description: `${kind} ${brand} ${model} de ${year}, ${hp} ch. Machine entretenue par nos équipes, livrée avec opérateur et carburant en location.`,
            status: i % 9 === 4 ? "MAINTENANCE" : "DISPONIBLE",
            isRentable,
            dailyRate: isRentable ? dailyRate : null,
            rotationRate: isRentable && rotationK ? rotationK * 1000 : null,
            degressiveFromDays: 7,
            degressiveDailyRate: isRentable
              ? round(dailyRate * 0.87, 5_000)
              : null,
            isForSale,
            salePrice: isForSale
              ? (Math.round(newPriceM * (1 - age * 0.035) * 2) / 2) * 1_000_000
              : null,
            isPublished: i % 5 !== 4,
            images: {
              create: [{ url: u(photos[i % photos.length]!), position: 0 }],
            },
          },
        });
      });
      created++;
    }
    catIndex++;
  }
  console.log(`✔ Flotte : ${created} machine(s) ajoutée(s) (20 par catégorie)`);
}
