// Catalogue de démonstration : 20 pièces par famille (100 au total), avec stocks variés (dont des stocks faibles).
// Idempotent : une pièce (nom + marque) n'est jamais créée deux fois.
// Les références OEM sont illustratives : à remplacer par les vraies références du catalogue du client.
import type { PrismaClient } from "../../src/generated/prisma/client.js";

type Family = "MOTEUR" | "HYDRAULIQUE" | "FILTRATION" | "ELECTRICITE" | "AUTRE";
// [désignation, prix en FCFA (pièce d'origine, neuve), garantie en mois, consommable (seuil d'alerte plus haut)]
type Item = [string, number, number | null, boolean?];

const ITEMS: Record<Family, Item[]> = {
  MOTEUR: [
    ["Joint de culasse", 185_000, 6],
    ["Kit de segmentation", 420_000, 6],
    ["Jeu de pistons", 650_000, 6],
    ["Chemises de cylindre (jeu)", 580_000, 6],
    ["Vilebrequin", 1_900_000, 12],
    ["Turbocompresseur", 1_250_000, 12],
    ["Pompe à eau", 165_000, 6],
    ["Pompe à huile", 240_000, 6],
    ["Injecteur", 210_000, 6],
    ["Pompe d'injection", 1_450_000, 12],
    ["Courroie de ventilateur", 38_000, null, true],
    ["Radiateur", 780_000, 6],
    ["Thermostat", 45_000, null, true],
    ["Kit de joints moteur", 310_000, 6],
    ["Arbre à cames", 880_000, 12],
    ["Coussinets de bielle (jeu)", 195_000, 6],
    ["Poulie tendeuse", 92_000, 6],
    ["Ventilateur de refroidissement", 340_000, 6],
    ["Collecteur d'échappement", 460_000, 6],
    ["Carter d'huile", 380_000, 6],
  ],
  HYDRAULIQUE: [
    ["Pompe hydraulique principale", 1_850_000, 12],
    ["Distributeur principal", 2_300_000, 12],
    ["Moteur de rotation", 1_700_000, 12],
    ["Moteur de translation", 2_100_000, 12],
    ["Vérin de flèche", 1_450_000, 12],
    ["Vérin de balancier", 1_250_000, 12],
    ["Vérin de godet", 980_000, 12],
    ["Kit de joints de vérin", 120_000, null, true],
    ["Flexible haute pression", 65_000, null, true],
    ["Électrovanne de pilotage", 190_000, 6],
    ["Réducteur de rotation", 1_600_000, 12],
    ["Accumulateur", 210_000, 6],
    ["Refroidisseur d'huile hydraulique", 560_000, 6],
    ["Clapet anti-retour", 85_000, 6],
    ["Manipulateur (joystick)", 480_000, 6],
    ["Raccord tournant", 720_000, 6],
    ["Pompe de pilotage", 390_000, 6],
    ["Soupape de sécurité", 135_000, 6],
    ["Bloc de commande de flèche", 640_000, 6],
    ["Kit de flexibles (jeu)", 150_000, null, true],
  ],
  FILTRATION: [
    ["Filtre à huile moteur", 28_000, null, true],
    ["Filtre à carburant", 32_000, null, true],
    ["Filtre à air primaire", 55_000, null, true],
    ["Filtre à air secondaire", 38_000, null, true],
    ["Filtre hydraulique", 85_000, null, true],
    ["Filtre de pilotage", 42_000, null, true],
    ["Séparateur eau/gasoil", 68_000, null, true],
    ["Filtre d'habitacle", 18_000, null, true],
    ["Filtre de transmission", 74_000, null, true],
    ["Cartouche déshydrateur d'air", 96_000, null, true],
    ["Préfiltre à carburant", 36_000, null, true],
    ["Filtre de retour hydraulique", 92_000, null, true],
    ["Filtre de liquide de refroidissement", 30_000, null, true],
    ["Élément de filtre à air (grande taille)", 78_000, null, true],
    ["Filtre à huile de pont", 41_000, null, true],
    ["Filtre de reniflard", 22_000, null, true],
    ["Kit d'entretien 500 h", 185_000, null, true],
    ["Kit d'entretien 1 000 h", 340_000, null, true],
    ["Kit d'entretien 2 000 h", 620_000, null, true],
    ["Crépine d'aspiration hydraulique", 58_000, null, true],
  ],
  ELECTRICITE: [
    ["Alternateur", 460_000, 6],
    ["Démarreur", 520_000, 6],
    ["Batterie 12 V 200 Ah", 145_000, 6],
    ["Faisceau électrique cabine", 680_000, 6],
    ["Calculateur moteur (ECU)", 1_350_000, 12],
    ["Capteur de pression d'huile", 48_000, 3],
    ["Capteur de température", 42_000, 3],
    ["Relais de démarrage", 36_000, 3],
    ["Phare de travail LED", 78_000, 6],
    ["Feu arrière", 54_000, 3],
    ["Avertisseur sonore", 28_000, 3],
    ["Contacteur à clé", 35_000, 3],
    ["Tableau de bord", 590_000, 6],
    ["Capteur de régime", 62_000, 3],
    ["Bougie de préchauffage (jeu)", 74_000, null, true],
    ["Solénoïde d'arrêt moteur", 125_000, 6],
    ["Kit de fusibles", 24_000, null, true],
    ["Commodo de commande", 88_000, 3],
    ["Gyrophare", 66_000, 6],
    ["Moteur d'essuie-glace", 95_000, 6],
  ],
  AUTRE: [
    ["Dents de godet (jeu de 5)", 275_000, null, true],
    ["Lame de bulldozer", 1_250_000, 6],
    ["Couteaux latéraux (paire)", 410_000, 6],
    ["Chaîne de train de roulement", 2_800_000, 12],
    ["Galets inférieurs (jeu)", 1_150_000, 12],
    ["Rouleaux supérieurs (jeu)", 520_000, 12],
    ["Roue folle avant", 890_000, 12],
    ["Barbotin", 760_000, 12],
    ["Patins de chenille (jeu)", 1_650_000, 12],
    ["Pneu de chargeuse 23.5R25", 1_950_000, 12],
    ["Godet 1 m³", 1_400_000, 6],
    ["Axes et bagues de godet (kit)", 185_000, null, true],
    ["Siège conducteur", 420_000, 6],
    ["Pare-brise", 260_000, 3],
    ["Plaquettes de frein (jeu)", 98_000, null, true],
    ["Kit d'embrayage", 540_000, 6],
    ["Rétroviseur", 42_000, 3],
    ["Marchepied", 56_000, 3],
    ["Kit de graissage centralisé", 480_000, 6],
    ["Bras de godet (rallonge)", 1_100_000, 6],
  ],
};

// Marques d'origine → modèles de la flotte (voir seed-fleet.ts) ; marques « compatibles » pour les pièces non d'origine
const OEM: Record<string, { prefix: string; models: string[] }> = {
  Caterpillar: {
    prefix: "CAT",
    models: [
      "320D",
      "320GC",
      "323D",
      "330D",
      "950GC",
      "966H",
      "D6R",
      "D6T",
      "D7R",
      "D8R",
    ],
  },
  Komatsu: {
    prefix: "KOM",
    models: [
      "PC200-8",
      "PC210-10",
      "PC300-8",
      "PC350-8",
      "WA320-6",
      "WA380-8",
      "D65EX-16",
      "D85EX-15",
    ],
  },
  Hitachi: { prefix: "HIT", models: ["ZX200-5G", "ZX210LC-5", "ZX350LC-5"] },
  Volvo: {
    prefix: "VOL",
    models: [
      "EC210D",
      "EC250D",
      "EC300D",
      "L90H",
      "L120H",
      "FMX 410",
      "FH 460",
    ],
  },
  JCB: { prefix: "JCB", models: ["3CX", "4CX", "5CX", "JS220"] },
  "Mercedes-Benz": {
    prefix: "MB",
    models: ["Actros 3340", "Actros 3341", "Arocs 3345"],
  },
};
const OEM_BRANDS = Object.keys(OEM);
const AFTERMARKET: Record<Family, string[]> = {
  MOTEUR: ["Delphi", "Bosch"],
  HYDRAULIQUE: ["Parker", "Rexroth"],
  FILTRATION: ["Donaldson", "Fleetguard", "Mann-Filter"],
  ELECTRICITE: ["Bosch", "Prestolite"],
  AUTRE: ["Berco", "ITR"],
};

const u = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;
const PHOTOS = [
  "photo-1603814744347-31a27ca92271",
  "photo-1652248759121-2edb066a9557",
  "photo-1580901368813-93220b510345",
];
const STOCKS = [0, 1, 2, 3, 5, 8, 12, 18, 24, 40]; // mélange volontaire : ruptures et stocks faibles inclus
const round = (n: number, step: number) => Math.round(n / step) * step;

export async function seedParts(prisma: PrismaClient) {
  let created = 0;
  for (const [family, items] of Object.entries(ITEMS) as [Family, Item[]][]) {
    for (const [
      i,
      [type, basePrice, warranty, consumable],
    ] of items.entries()) {
      const aftermarket = i % 4 === 3; // 1 pièce sur 4 : marque compatible, moins chère, non d'origine
      const pool = AFTERMARKET[family];
      const brand = aftermarket
        ? pool[i % pool.length]!
        : OEM_BRANDS[(i + family.length) % OEM_BRANDS.length]!;
      const name = `${type} ${brand}`;
      if (
        await prisma.part.findFirst({
          where: { name, brand },
          select: { id: true },
        })
      )
        continue;

      // Compatibilité : 2 à 4 modèles de la marque (ou d'une marque d'origine pour les pièces compatibles)
      const source = OEM[brand] ?? OEM[OEM_BRANDS[i % OEM_BRANDS.length]!]!;
      const start = i % source.models.length;
      const compatibleModels = Array.from(
        { length: 2 + (i % 3) },
        (_, k) => source.models[(start + k) % source.models.length]!,
      ).filter((m, k, a) => a.indexOf(m) === k);
      const used =
        !aftermarket && !consumable && basePrice >= 400_000 && i % 7 === 6; // quelques pièces d'occasion

      await prisma.part.create({
        data: {
          name,
          brand,
          family,
          compatibleModels,
          oemReference: `${OEM[brand]?.prefix ?? brand.slice(0, 3).toUpperCase()}-${family.slice(0, 2)}${String(i + 1).padStart(2, "0")}-${100 + ((i * 37) % 900)}`,
          condition: used ? "OCCASION" : "NEUF",
          isOriginal: !aftermarket,
          price: round(
            basePrice * (aftermarket ? 0.65 : 1) * (used ? 0.55 : 1),
            500,
          ),
          stockQuantity: STOCKS[(i * 7 + family.length) % STOCKS.length]!,
          lowStockThreshold: consumable ? 5 : 2,
          warrantyMonths: used ? 3 : warranty,
          description: `${type} ${aftermarket ? "compatible" : "d'origine"} ${brand}, compatible ${compatibleModels.join(", ")}.`,
          isPublished: i % 6 !== 5,
          images: {
            create: [{ url: u(PHOTOS[i % PHOTOS.length]!), position: 0 }],
          },
        },
      });
      created++;
    }
  }
  console.log(`✔ Catalogue : ${created} pièce(s) ajoutée(s) (20 par famille)`);
}
