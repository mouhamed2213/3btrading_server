import { describe, expect, it } from "vitest";
import { computeTotals, withTax } from "../src/modules/invoices/totals.js";
import { computeRentalPrice, countDays } from "../src/modules/reservations/pricing.js";
import { worksiteAmount } from "../src/modules/worksites/worksites.service.js";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const rates = { dailyRate: 550_000, rotationRate: 45_000, degressiveFromDays: 7, degressiveDailyRate: 480_000 };

describe("location", () => {
  it("compte les jours bornes incluses", () => {
    expect(countDays(d("2026-10-12"), d("2026-10-12"))).toBe(1);
    expect(countDays(d("2026-10-12"), d("2026-10-19"))).toBe(8);
  });

  it("applique le tarif journalier sous le seuil dégressif", () => {
    const p = computeRentalPrice({ pricing: "JOURNALIER", startDate: d("2026-10-12"), endDate: d("2026-10-17") }, rates);
    expect(p).toEqual({ quantity: 6, unitPrice: 550_000, totalAmount: 3_300_000, isDegressive: false });
  });

  it("applique le tarif dégressif dès 7 jours sur toute la durée", () => {
    const p = computeRentalPrice({ pricing: "JOURNALIER", startDate: d("2026-10-12"), endDate: d("2026-10-18") }, rates);
    expect(p).toEqual({ quantity: 7, unitPrice: 480_000, totalAmount: 3_360_000, isDegressive: true });
  });

  it("ignore la dégressivité si aucun tarif dégressif n'est défini", () => {
    const p = computeRentalPrice({ pricing: "JOURNALIER", startDate: d("2026-10-01"), endDate: d("2026-10-30") }, { ...rates, degressiveDailyRate: null });
    expect(p.unitPrice).toBe(550_000);
    expect(p.isDegressive).toBe(false);
  });

  it("calcule une location à la rotation", () => {
    const p = computeRentalPrice({ pricing: "ROTATION", startDate: d("2026-10-12"), endDate: d("2026-10-12"), rotations: 12 }, rates);
    expect(p).toEqual({ quantity: 12, unitPrice: 45_000, totalAmount: 540_000, isDegressive: false });
  });

  it("refuse les cas invalides", () => {
    expect(() => computeRentalPrice({ pricing: "ROTATION", startDate: d("2026-10-12"), endDate: d("2026-10-12") }, rates)).toThrow(/rotations/);
    expect(() => computeRentalPrice({ pricing: "ROTATION", startDate: d("2026-10-12"), endDate: d("2026-10-12"), rotations: 2 }, { ...rates, rotationRate: null })).toThrow(/rotation/);
    expect(() => computeRentalPrice({ pricing: "JOURNALIER", startDate: d("2026-10-12"), endDate: d("2026-10-10") }, rates)).toThrow(/fin/);
  });
});

describe("facturation", () => {
  it("calcule HT, TVA 18 % et TTC", () => {
    expect(computeTotals([{ quantity: 3, unitPrice: 550_000 }], 18)).toEqual({ subtotal: 1_650_000, taxAmount: 297_000, total: 1_947_000 });
  });

  it("gère les lignes de déduction d'acompte", () => {
    const t = computeTotals([{ quantity: 6, unitPrice: 550_000 }, { quantity: 1, unitPrice: -1_000_000 }], 18);
    expect(t).toEqual({ subtotal: 2_300_000, taxAmount: 414_000, total: 2_714_000 });
  });

  it("withTax arrondit au FCFA", () => {
    expect(withTax(1_001, 18)).toBe(1_181);
  });
});

describe("chantiers", () => {
  it("forfait = prix global, quel que soit l'avancement", () => {
    expect(worksiteAmount({ pricing: "FORFAIT", unitPrice: 8_000_000 }, 0)).toBe(8_000_000);
  });
  it("au volume = prix/m³ × cubage réalisé", () => {
    expect(worksiteAmount({ pricing: "VOLUME", unitPrice: 3_500 }, 1_250.5)).toBe(4_376_750);
  });
});
