import { describe, expect, it } from 'vitest';
import { HEADERS, fieldForHeader, parseTab, serialize } from '$lib/storage/google-sheets';
import { isSplitParent } from '$lib/domain/splits';
import { spentInMonth } from '$lib/domain/budget';
import type { Transaction } from '$lib/domain/types';

/** Sheet contract (docs/study.md §5): tab headers and cent-based money columns. */
describe('sheet tab headers (spec §5)', () => {
  it('Transactions uses amount_cents and the spec column order', () => {
    expect(HEADERS.Transactions.slice(0, 8)).toEqual([
      'id',
      'date',
      'amount_cents',
      'payee_id',
      'category_id',
      'account_id',
      'goal_id',
      'type'
    ]);
    expect(HEADERS.Transactions).toContain('transfer_pair_id');
    expect(HEADERS.Transactions).toContain('excluded_from_budget');
  });

  it('money columns are named *_cents and rates *_bps', () => {
    expect(HEADERS.MonthBudgets).toContain('budgeted_cents');
    expect(HEADERS.IncomePlan).toContain('pay_amount_cents');
    expect(HEADERS.Goals).toEqual(
      expect.arrayContaining([
        'target_amount_cents',
        'saved_so_far_cents',
        'monthly_contribution_cents',
        'debt_apr_bps',
        'debt_min_payment_cents'
      ])
    );
    expect(HEADERS.Categories).toContain('monthly_target_cents');
    expect(HEADERS.Categories).toContain('target_percent_of_income');
    expect(HEADERS.Subscriptions).toContain('amount_cents');
    expect(HEADERS.RepeatRules).toContain('amount_cents');
  });

  it('header names map back to domain fields', () => {
    expect(fieldForHeader('Transactions', 'amount_cents')).toBe('amount');
    expect(fieldForHeader('Goals', 'debt_apr_bps')).toBe('debt_apr');
    expect(fieldForHeader('Categories', 'target_percent_of_income')).toBe('target_percent');
    expect(fieldForHeader('Transactions', 'description')).toBe('description');
  });

  it('every tab has created_at, updated_at, device_id and deleted_at', () => {
    for (const tab of ['Accounts', 'Groups', 'Categories', 'Transactions', 'Goals'] as const) {
      expect(HEADERS[tab]).toEqual(expect.arrayContaining(['created_at', 'updated_at', 'device_id', 'deleted_at']));
    }
  });
});

describe('row round trip', () => {
  it('a transaction survives serialize → parse with cents, tags and nulls intact', () => {
    const tx = {
      id: 't1',
      date: '2026-11-03',
      amount: -12345,
      payee_id: 'p1',
      category_id: 'c1',
      account_id: 'a1',
      goal_id: null,
      type: 'expense',
      description: 'Groceries',
      notes: '',
      tags: ['x'],
      is_split: false,
      split_parent_id: null,
      transfer_pair_id: null,
      excluded_from_budget: false,
      repeat_rule_id: null,
      import_id: '',
      created_at: '2026-11-03T00:00:00.000Z',
      updated_at: '2026-11-03T00:00:00.000Z',
      device_id: 'd1',
      deleted_at: null
    };
    const header = HEADERS.Transactions;
    const parsed = parseTab('Transactions', [header, serialize('Transactions', tx)]);
    const back = parsed.rows[0]!.entity as Partial<Transaction>;
    expect(back.amount).toBe(-12345);
    expect(back.tags).toEqual(['x']);
    expect(back.category_id).toBe('c1');
    expect(back.goal_id).toBeNull();
    expect(parsed.idToRow.get('t1')).toBe(2);
  });
});

describe('split rows (spec §5 SplitTransaction)', () => {
  const parent = {
    id: 'p',
    is_split: true,
    split_parent_id: null
  } as Pick<Transaction, 'is_split' | 'split_parent_id'>;
  const child = {
    id: 'c',
    is_split: true,
    split_parent_id: 'p'
  } as Pick<Transaction, 'is_split' | 'split_parent_id'>;

  it('only the parent is a split parent', () => {
    expect(isSplitParent(parent)).toBe(true);
    expect(isSplitParent(child)).toBe(false);
  });

  it('spent counts children once, never the parent', () => {
    const base = {
      date: '2026-11-05',
      type: 'expense',
      account_id: 'a',
      payee_id: 'p',
      excluded_from_budget: false,
      transfer_pair_id: null,
      deleted_at: null,
      goal_id: null,
      tags: [],
      notes: '',
      description: '',
      import_id: '',
      repeat_rule_id: null,
      created_at: '',
      updated_at: '',
      device_id: ''
    };
    const rows = [
      { ...base, id: 'p', amount: -10000, category_id: null, is_split: true, split_parent_id: null },
      { ...base, id: 'c1', amount: -6000, category_id: 'x', is_split: true, split_parent_id: 'p' },
      { ...base, id: 'c2', amount: -4000, category_id: 'y', is_split: true, split_parent_id: 'p' }
    ] as Transaction[];
    expect(spentInMonth(rows, '2026-11')).toBe(10000);
  });
});
