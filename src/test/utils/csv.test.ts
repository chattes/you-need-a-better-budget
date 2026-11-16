import { describe, expect, it } from 'vitest';
import { CSV_HEADER, importId, parseCsv, transactionsToCsv } from '$lib/utils/csv';
import { transaction } from '../domain/fixtures';

const SPEC_HEADER =
  'Date,Description,Amount,Category,Group,Type,Tags,Notes,Excluded from Budget,Account,Account Last 4,Bank,Original Amount,Original Currency,FX Rate';

const ctx = {
  accounts: [{ id: 'acc1', name: 'Chequing' } as never],
  categories: [{ id: 'cat1', name: 'Groceries', group_id: 'g1' } as never],
  groups: [{ id: 'g1', name: 'Food & Dining' } as never]
};

describe('CSV export (spec §7)', () => {
  it('header row is exactly the spec column list', () => {
    expect(CSV_HEADER.join(',')).toBe(SPEC_HEADER);
    const csv = transactionsToCsv([], ctx);
    expect(csv.split('\n')[0]).toBe(SPEC_HEADER);
  });

  it('writes a row with names, cent amounts and TRUE/FALSE flags', () => {
    const t = transaction({
      id: 't1',
      date: '2026-11-04',
      amount: -4250,
      description: 'Market',
      category_id: 'cat1',
      account_id: 'acc1',
      type: 'expense',
      tags: ['weekly', 'food'],
      excluded_from_budget: false
    });
    const line = transactionsToCsv([t], ctx).split('\n')[1]!;
    expect(line).toBe('2026-11-04,Market,-42.50,Groceries,Food & Dining,expense,weekly;food,,FALSE,Chequing,,,,,');
  });
});

describe('CSV import uses the same format', () => {
  it('export → import round trip keeps date, amount, description and category name', () => {
    const t = transaction({ id: 't2', date: '2026-11-09', amount: 1500, description: 'Refund', type: 'income', account_id: 'acc1', category_id: null });
    const csv = transactionsToCsv([t], ctx);
    const parsed = parseCsv(csv);
    expect(parsed.missingColumns).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({ date: '2026-11-09', amount: 1500, description: 'Refund', type: 'income', account: 'Chequing' });
  });

  it('reports missing required columns instead of importing', () => {
    const parsed = parseCsv('Date,Description\n2026-01-01,Coffee');
    expect(parsed.missingColumns).toEqual(['Amount']);
    expect(parsed.rows).toEqual([]);
  });

  it('import_id is stable for the same date, amount, description and account', () => {
    expect(importId('2026-11-01', -500, 'Coffee', 'Chequing')).toBe(importId('2026-11-01', -500, ' coffee ', 'chequing'));
    expect(importId('2026-11-01', -500, 'Coffee', 'Chequing')).not.toBe(importId('2026-11-02', -500, 'Coffee', 'Chequing'));
  });
});
