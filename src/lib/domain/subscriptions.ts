import type { Subscription, SubscriptionCadence } from './types';

/** Annual cost of one subscription (derived, never stored). */
export function annualCost(amount: number, cadence: SubscriptionCadence): number {
  switch (cadence) {
    case 'weekly':
      return amount * 52;
    case 'monthly':
      return amount * 12;
    case 'quarterly':
      return amount * 4;
    case 'yearly':
      return amount;
  }
}

/** Sum of annual costs for live subscriptions. */
export function annualTotal(subs: Subscription[]): number {
  return subs
    .filter((s) => !s.deleted_at)
    .reduce((sum, s) => sum + annualCost(s.amount, s.cadence), 0);
}

/** Subscriptions charging between `from` and `to` (inclusive, YYYY-MM-DD), by next charge date. */
export function upcomingCharges(subs: Subscription[], from: string, to: string): Subscription[] {
  return subs
    .filter((s) => !s.deleted_at && s.next_charge_date >= from && s.next_charge_date <= to)
    .sort((a, b) => a.next_charge_date.localeCompare(b.next_charge_date));
}
