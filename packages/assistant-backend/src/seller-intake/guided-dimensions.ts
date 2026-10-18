import type { SellerDimensionMeasurement } from '@monabid/shared';

// Only explicit measurements are accepted; a bare pair never implies a unit.
export function guidedDimensions(input: string): {
  values: SellerDimensionMeasurement[];
  needsUnit: boolean;
} | undefined {
  const matches = [...input.matchAll(/(?<![\d.\-])([0-9]+(?:\.[0-9]+)?)\s*[xX×*]\s*([0-9]+(?:\.[0-9]+)?)(?:\s*[xX×*]\s*([0-9]+(?:\.[0-9]+)?))?\s*(cm\b|mm\b|inches\b|inch\b|ס["״]?מ|מ["״]?מ)?/g)];
  const match = matches.at(-1);
  if (!match) return undefined;
  const numbers = match.slice(1, 4).filter(value => value !== undefined).map(Number);
  if (numbers.some(value => !Number.isFinite(value) || value <= 0)) return undefined;
  if (!match[4]) return { values: [], needsUnit: true };
  const rawUnit = match[4].toLowerCase();
  const unit = /^(?:cm|ס)/.test(rawUnit) ? 'cm' : /^(?:mm|מ)/.test(rawUnit) ? 'mm' : 'inch';
  return {
    values: numbers.map((value, index) => ({ label: index === 0 ? 'width' : index === 1 ? 'height' : 'depth', value, unit })),
    needsUnit: false,
  };
}
