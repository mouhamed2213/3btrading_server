import { badRequest } from "../../lib/errors.js";

export type RateCard = {
  dailyRate: number | null;
  rotationRate: number | null;
  degressiveFromDays: number;
  degressiveDailyRate: number | null;
};

export type RentalPriceInput = {
  pricing: "JOURNALIER" | "ROTATION";
  startDate: Date;
  endDate: Date;
  rotations?: number | null;
};

const DAY_MS = 86_400_000;

/** Nombre de jours calendaires, bornes incluses (du 12 au 19 = 8 jours). */
export function countDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/**
 * Prix HT d'une location clé en main (opérateur et carburant inclus).
 * - JOURNALIER : jours × tarif journalier ; dès `degressiveFromDays` jours, le tarif dégressif s'applique à toute la durée.
 * - ROTATION : nombre de voyages × tarif par rotation (camions-bennes).
 */
export function computeRentalPrice(input: RentalPriceInput, rates: RateCard) {
  if (input.endDate < input.startDate) throw badRequest("La date de fin précède la date de début");

  if (input.pricing === "ROTATION") {
    if (!rates.rotationRate) throw badRequest("Cet engin n'a pas de tarif par rotation");
    if (!input.rotations || input.rotations < 1) throw badRequest("Le nombre de rotations est requis pour une tarification par rotation");
    return {
      quantity: input.rotations,
      unitPrice: rates.rotationRate,
      totalAmount: input.rotations * rates.rotationRate,
      isDegressive: false,
    };
  }

  if (!rates.dailyRate) throw badRequest("Cet engin n'a pas de tarif journalier");
  const days = countDays(input.startDate, input.endDate);
  const isDegressive = !!rates.degressiveDailyRate && days >= rates.degressiveFromDays;
  const unitPrice = isDegressive ? rates.degressiveDailyRate! : rates.dailyRate;
  return { quantity: days, unitPrice, totalAmount: days * unitPrice, isDegressive };
}
