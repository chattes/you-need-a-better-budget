// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  IdbRepository,
  getOutbox,
  getSetting,
  getSnapshots,
  markOutboxSynced,
  saveSnapshot,
  setSetting
} from '$lib/storage/indexeddb';
import type { Account, MonthBudget } from '$lib/domain/types';
import { snapshot } from '$lib/domain/net-worth';
import { mergeDuplicateMonthBudgets, monthBudgetId } from '$lib/domain/budget';
import { account, monthBudget } from '../domain/fixtures';

describe('IndexedDB repository contract', () => {
  const repo = new IdbRepository<Account>('accounts');

  it('upsert + getAll + getById', async () => {
    const a = account({ name: 'Checking', balance: 100_000 });
    await repo.upsert(a);
    expect(await repo.getById(a.id)).toEqual(a);
    const all = await repo.getAll();
    expect(all.some((x) => x.id === a.id)).toBe(true);
  });

  it('soft delete hides from getAll/getById but keeps row with deleted_at', async () => {
    const a = account({ name: 'ToDelete' });
    await repo.upsert(a);
    await repo.delete(a.id);
    expect(await repo.getById(a.id)).toBeNull();
    expect((await repo.getAll()).some((x) => x.id === a.id)).toBe(false);
    const raw = await repo.getRaw(a.id);
    expect(raw?.deleted_at).toBeTruthy();
  });

  it('mutations queue outbox entries; markOutboxSynced clears them', async () => {
    const a = account({ name: 'OutboxTest' });
    await repo.upsert(a);
    const outbox = await getOutbox();
    expect(outbox.some((e) => e.entity === 'accounts' && e.payload.id === a.id)).toBe(true);
    await markOutboxSynced(outbox.map((e) => e.id));
    expect((await getOutbox()).filter((e) => e.payload.id === a.id)).toHaveLength(0);
  });

  it('getChangesSince returns only newer rows with operation', async () => {
    const a = account({ name: 'Since' });
    a.updated_at = '2026-11-10T00:00:00.000Z';
    await repo.applyRemote(a);
    const changes = await repo.getChangesSince('2026-11-01T00:00:00.000Z');
    const hit = changes.find((c) => c.id === a.id);
    expect(hit?.operation).toBe('upsert');
    const none = await repo.getChangesSince('2027-01-01T00:00:00.000Z');
    expect(none.some((c) => c.id === a.id)).toBe(false);
  });

  it('getSince on a deleted row reports delete operation', async () => {
    const a = account({ name: 'DelSince' });
    a.updated_at = '2026-11-10T00:00:00.000Z';
    await repo.applyRemote(a);
    await repo.delete(a.id);
    const changes = await repo.getChangesSince('2026-11-01T00:00:00.000Z');
    expect(changes.find((c) => c.id === a.id)?.operation).toBe('delete');
  });

  it('settings round-trip', async () => {
    await setSetting('theme', 'dark');
    expect(await getSetting('theme')).toBe('dark');
    expect(await getSetting('missing')).toBeNull();
  });

  it('snapshots save + read', async () => {
    const accounts = [account({ name: 'A', balance: 50_000 })];
    const snap = snapshot(accounts, '2026-11-15');
    await saveSnapshot(snap);
    const all = await getSnapshots();
    expect(all.some((s) => s.date === '2026-11-15' && s.net_worth === 50_000)).toBe(true);
  });
});

describe('MonthBudget idempotency (regression: duplicate assign rows)', () => {
  const repo = new IdbRepository<MonthBudget>('month_budgets');

  it('upsert by (month, category) key updates in place — one row per key', async () => {
    const id = monthBudgetId('2026-11', 'cat-groceries');
    await repo.upsert(monthBudget({ id, month: '2026-11', category_id: 'cat-groceries', budgeted: 60_000 }));
    await repo.upsert(
      monthBudget({ id, month: '2026-11', category_id: 'cat-groceries', budgeted: 60_000 })
    );
    const rows = (await repo.getAll()).filter(
      (r) => r.month === '2026-11' && r.category_id === 'cat-groceries'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.budgeted).toBe(60_000);
  });

  it('mergeDuplicateMonthBudgets collapses legacy duplicates, keeping newest', () => {
    const older = monthBudget({
      id: 'dup-1',
      month: '2026-11',
      category_id: 'cat-x',
      budgeted: 60_000,
      updated_at: '2026-11-01T00:00:00.000Z'
    });
    const newer = monthBudget({
      id: 'dup-2',
      month: '2026-11',
      category_id: 'cat-x',
      budgeted: 60_000,
      updated_at: '2026-11-02T00:00:00.000Z'
    });
    const { merged, duplicateIds } = mergeDuplicateMonthBudgets([older, newer]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.id).toBe('dup-2');
    expect(duplicateIds).toEqual(['dup-1']);
  });
});
