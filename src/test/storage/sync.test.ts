// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { IdbRepository, setSetting, getOutbox, markOutboxSynced } from '$lib/storage/indexeddb';
import { LAST_SYNC_KEY, SHEET_ID_KEY, pushAllLocal, syncNow, type SheetsClient } from '$lib/storage/sync';
import type { TabData, TabName } from '$lib/storage/google-sheets';
import type { Account } from '$lib/domain/types';
import { account } from '../domain/fixtures';

function emptyTabs(): Record<TabName, TabData> {
  const tabs = [
    'Accounts',
    'Categories',
    'Transactions',
    'Months/Budget',
    'Goals',
    'Scheduled',
    'Payees',
    'Settings',
    'Snapshots'
  ] as const;
  return Object.fromEntries(tabs.map((t) => [t, { rows: [], idToRow: new Map() }])) as unknown as Record<
    TabName,
    TabData
  >;
}

async function connect(): Promise<void> {
  await setSetting(SHEET_ID_KEY, 'sheet-123');
  await setSetting(LAST_SYNC_KEY, new Date(0).toISOString());
}

describe('sync push reuses the pull id→row map (mocked Sheets client)', () => {
  it('updates existing rows in place, no per-tab re-read, no rebuild without appends', async () => {
    await connect();
    const repo = new IdbRepository<Account>('accounts');
    const a = account({ name: 'Checking', balance: 100_000 });
    await repo.upsert(a); // queues outbox

    const pullMap = new Map([[a.id, 2]]);
    const client: SheetsClient = {
      readAllTabs: vi.fn(async () => ({
        ...emptyTabs(),
        Accounts: {
          rows: [{ row: 2, entity: { ...a, updated_at: '2020-01-01T00:00:00.000Z' } }],
          idToRow: pullMap
        }
      })),
      readTab: vi.fn(async () => ({ rows: [], idToRow: new Map() })),
      upsertRows: vi.fn(async (_id, _tab, entities, idToRow) => {
        // simulate in-place update of the existing row
        expect(idToRow).toBe(pullMap); // same map instance from the pull
        void entities;
        return { updated: entities.length, appended: 0 };
      })
    };

    const result = await syncNow(undefined, client);
    expect(result.pushed).toBe(1);
    expect(client.readAllTabs).toHaveBeenCalledTimes(1);
    expect(client.readTab).not.toHaveBeenCalled(); // map reused, no rebuild
    expect(client.upsertRows).toHaveBeenCalledTimes(1);
    expect(await getOutbox()).toHaveLength(0); // marked synced
  });

  it('rebuilds the id→row map after an append', async () => {
    await connect();
    // clean outbox from previous test
    await markOutboxSynced((await getOutbox()).map((e) => e.id));
    const repo = new IdbRepository<Account>('accounts');
    const b = account({ name: 'New Savings', balance: 5_000 });
    await repo.upsert(b);

    const readTab = vi.fn(async () => ({ rows: [], idToRow: new Map([[b.id, 3]]) }));
    const client: SheetsClient = {
      readAllTabs: vi.fn(async () => emptyTabs()),
      readTab,
      upsertRows: vi.fn(async (_id, _tab, entities) => ({ updated: 0, appended: entities.length }))
    };

    const result = await syncNow(undefined, client);
    expect(result.pushed).toBeGreaterThanOrEqual(1);
    expect(readTab).toHaveBeenCalledWith('sheet-123', 'Accounts'); // rebuilt after append
  });

  it('first-run pushAllLocal reads all tabs once and reuses the id→row map', async () => {
    await markOutboxSynced((await getOutbox()).map((e) => e.id));
    const repo = new IdbRepository<Account>('accounts');
    const c = account({ name: 'Everyday', balance: 7_500 });
    await repo.upsert(c);

    const accountsMap = new Map<string, number>();
    const client: SheetsClient = {
      readAllTabs: vi.fn(async () => ({
        ...emptyTabs(),
        Accounts: { rows: [], idToRow: accountsMap }
      })),
      readTab: vi.fn(async () => ({ rows: [], idToRow: new Map() })),
      upsertRows: vi.fn(async (_id, tab, entities, idToRow) => {
        if (tab === 'Accounts') expect(idToRow).toBe(accountsMap);
        void entities;
        return { updated: 0, appended: entities.length };
      })
    };

    await pushAllLocal('sheet-123', client);
    expect(client.readAllTabs).toHaveBeenCalledTimes(1);
    expect(client.readTab).not.toHaveBeenCalled();
    expect(client.upsertRows).toHaveBeenCalledWith(
      'sheet-123',
      'Accounts',
      expect.arrayContaining([expect.objectContaining({ id: c.id })]),
      accountsMap
    );
  });
});
