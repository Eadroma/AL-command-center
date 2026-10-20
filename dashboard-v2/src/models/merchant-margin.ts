/** One production step, with total loss on failure and independent repeated attempts. */
export function merchantMargin(parts: { quantity: number; unitCost: number }[], fee: number, probability: number, salePrice: number) {
  if (!parts.length || parts.some(p => !Number.isFinite(p.unitCost) || p.unitCost < 0 || !Number.isFinite(p.quantity) || p.quantity <= 0) || ![fee, probability, salePrice].every(Number.isFinite) || fee < 0 || salePrice < 0 || probability <= 0 || probability > 1) return null;
  const attemptCost = parts.reduce((n, part) => n + part.quantity * part.unitCost, fee);
  const expectedCost = attemptCost / probability;
  return { attemptCost, expectedCost, margin: salePrice - expectedCost, breakEven: expectedCost };
}
