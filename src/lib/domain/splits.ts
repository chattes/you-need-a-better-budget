import type { SplitTransaction, Transaction } from './types';

/**
 * A split parent is the whole-amount row (is_split=true, no split_parent_id).
 * Child rows also carry is_split=true and point at the parent via
 * split_parent_id (spec §5). Only the children count toward budget and
 * reports, so parents are skipped by this check.
 */
export function isSplitParent(t: Pick<Transaction, 'is_split' | 'split_parent_id'>): boolean {
  return t.is_split && !t.split_parent_id;
}

/**
 * Users type split magnitudes as positive numbers; the sign follows the
 * parent transaction type (negative for expenses). Returns signed amounts.
 */
export function normalizeSplitAmounts(parentAmount: number, typedMagnitudes: number[]): number[] {
  const sign = parentAmount < 0 ? -1 : 1;
  return typedMagnitudes.map((m) => sign * Math.abs(m));
}

/** Formula 10 — split amounts must sum exactly to the parent amount. */
export function validateSplit(parent: Transaction, splits: SplitTransaction[]): boolean {
  const sum = splits.reduce((acc, s) => acc + s.amount, 0);
  return sum === parent.amount;
}

/**
 * Each split contributes its amount to its own category's activity.
 * Amounts are signed like transactions (expense negative).
 * Returns category_id → activity delta (positive = money spent).
 */
export function applySplitsToActivity(splits: SplitTransaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const split of splits) {
    const delta = -split.amount; // activity is stored positive for spend
    map.set(split.category_id, (map.get(split.category_id) ?? 0) + delta);
  }
  return map;
}
