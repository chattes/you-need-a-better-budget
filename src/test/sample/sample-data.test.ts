// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { getDb, getOutbox } from '$lib/storage/indexeddb';
import { isSampleActive, loadSampleData } from '$lib/sample/sample-data';
import { plannedIncome, remaining, setAside, spentInMonth } from '$lib/domain/budget';
import type { Category, IncomePlan, Transaction } from '$lib/domain/types';

describe('test mode sample data', () => {
  it('loads a demo budget and the dashboard Remaining equals planned − spent − set aside', async () => {
    const today = '2026-11-15';
    await loadSampleData(today);
    expect(await isSampleActive()).toBe(true);

    const db = await getDb();
    const txns = (await db.getAll('transactions')) as Transaction[];
    const categories = (await db.getAll('categories')) as Category[];
    const plans = (await db.getAll('income_plan')) as IncomePlan[];

    // Every sample row is marked demo-, and nothing was queued for Google Sheets.
    expect(txns.length).toBeGreaterThan(30);
    expect(txns.every((t) => t.id.startsWith('demo-'))).toBe(true);
    expect(categories).toHaveLength(10);
    expect(await getOutbox()).toHaveLength(0);

    // Same engine calls the Budget and Dashboard stores make (November 2026).
    const month = '2026-11';
    const planned = plannedIncome(plans, txns, month);
    const spent = spentInMonth(txns, month);
    const aside = setAside(categories, txns, [], month, planned);
    const left = remaining(planned, spent, aside);

    expect(planned).toBe(450000); // $4,500.00
    expect(spent).toBe(296565); // $2,965.65 (split children, card purchase counted; transfers not)
    expect(aside).toBe(27925); // coffee, fun, gifts, emergency fund unspent
    expect(left).toBe(125510); // $1,255.10
    expect(left).toBe(planned - spent - aside);
  });
});
