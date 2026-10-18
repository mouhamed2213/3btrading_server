export type LineInput = { quantity: number; unitPrice: number };

export function computeTotals(lines: LineInput[], taxRate: number) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

export const withTax = (amountHt: number, taxRate: number) => amountHt + Math.round((amountHt * taxRate) / 100);
