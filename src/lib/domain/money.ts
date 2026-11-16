// Money helpers. All amounts are integer cents.

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function toDollars(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(cents / 100);
}

export function parseToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Number(cleaned);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}
