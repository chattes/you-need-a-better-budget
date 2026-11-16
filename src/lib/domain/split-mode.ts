import type { TransactionType } from './types';

export interface SplitRowState {
  category_id: string;
  amount: string;
}

/** Two empty split rows, the state a fresh split editor starts with. */
export function blankSplitRows(): SplitRowState[] {
  return [
    { category_id: '', amount: '' },
    { category_id: '', amount: '' }
  ];
}

/**
 * Splits are an expense-only feature (each row is a spending category).
 * Returns the split state to keep when the transaction type changes:
 * a non-expense type turns split off and clears the rows.
 */
export function splitStateForType(
  type: TransactionType,
  splitMode: boolean,
  splits: SplitRowState[]
): { splitMode: boolean; splits: SplitRowState[] } {
  if (type === 'expense') return { splitMode, splits };
  return { splitMode: false, splits: blankSplitRows() };
}
