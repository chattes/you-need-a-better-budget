import { describe, expect, it } from 'vitest';
import { blankSplitRows, splitStateForType } from '$lib/domain/split-mode';

describe('split state when the transaction type changes', () => {
  const filled = [
    { category_id: 'cat-food', amount: '40.00' },
    { category_id: 'cat-fun', amount: '10.00' }
  ];

  it('switching to Income turns split off and clears the rows', () => {
    const next = splitStateForType('income', true, filled);
    expect(next.splitMode).toBe(false);
    expect(next.splits).toEqual(blankSplitRows());
  });

  it('switching to Transfer also clears the split rows', () => {
    const next = splitStateForType('transfer', true, filled);
    expect(next.splitMode).toBe(false);
    expect(next.splits).toEqual(blankSplitRows());
  });

  it('keeps split on for an expense', () => {
    const next = splitStateForType('expense', true, filled);
    expect(next).toEqual({ splitMode: true, splits: filled });
  });

  it('a split typed as expense does not leak into Income after switching back and forth', () => {
    const toIncome = splitStateForType('income', true, filled);
    const backToExpense = splitStateForType('expense', toIncome.splitMode, toIncome.splits);
    expect(backToExpense.splitMode).toBe(false);
    expect(backToExpense.splits.every((r) => r.category_id === '' && r.amount === '')).toBe(true);
  });
});
