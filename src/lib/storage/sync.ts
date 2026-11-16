// Sync engine: pull remote changes, last-write-wins merge, push outbox.
import {
  getOutbox,
  getSetting,
  IdbRepository,
  markOutboxSynced,
  setSetting,
  type EntityName
} from './indexeddb';
import { isSampleActive } from '$lib/sample/sample-data';
import {
  createSpreadsheet,
  readAllTabs,
  readTab,
  upsertRows,
  type TabData,
  type TabName
} from './google-sheets';

export const SHEET_ID_KEY = 'google_sheet_id';
export const LAST_SYNC_KEY = 'last_synced_at';

const ENTITY_TO_TAB: Record<EntityName, TabName> = {
  accounts: 'Accounts',
  categories: 'Categories',
  groups: 'Groups',
  transactions: 'Transactions',
  month_budgets: 'MonthBudgets',
  income_plan: 'IncomePlan',
  goals: 'Goals',
  subscriptions: 'Subscriptions',
  scheduled: 'RepeatRules',
  rules: 'Rules',
  tags: 'Tags',
  payees: 'Payees'
};

const SYNCABLE: EntityName[] = [
  'accounts',
  'groups',
  'categories',
  'transactions',
  'month_budgets',
  'income_plan',
  'goals',
  'subscriptions',
  'scheduled',
  'rules',
  'tags',
  'payees'
];

/** Sheets client interface — the real one calls the API; tests inject a mock. */
export interface SheetsClient {
  readAllTabs(spreadsheetId: string): Promise<Record<TabName, TabData>>;
  readTab(spreadsheetId: string, tab: TabName): Promise<TabData>;
  upsertRows(
    spreadsheetId: string,
    tab: TabName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entities: Array<Record<string, any>>,
    idToRow: Map<string, number>
  ): Promise<{ updated: number; appended: number }>;
}

const defaultClient: SheetsClient = { readAllTabs, readTab, upsertRows };

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: Array<{ entity: string; id: string; kept: 'local' | 'remote' }>;
}

export async function getSpreadsheetId(): Promise<string | null> {
  return getSetting(SHEET_ID_KEY);
}

/** First-run: create the spreadsheet, write headers, save id, push all local data. */
export async function connectSpreadsheet(): Promise<string> {
  // Test mode data must never reach a Google Sheet.
  if (await isSampleActive()) throw new Error('Sample data is loaded. Clear it before connecting Google Sheets.');
  const id = await createSpreadsheet();
  await setSetting(SHEET_ID_KEY, id);
  await setSetting(LAST_SYNC_KEY, new Date(0).toISOString());
  await pushAllLocal(id);
  return id;
}

/**
 * First-run push: one batch read builds every id→row map; the maps are then
 * reused for each tab's upsert (no per-entity re-reads).
 */
export async function pushAllLocal(spreadsheetId: string, client: SheetsClient = defaultClient): Promise<void> {
  const remote = await client.readAllTabs(spreadsheetId);
  for (const entityName of SYNCABLE) {
    const repo = new IdbRepository(entityName);
    const rows = await repo.getSince(new Date(0).toISOString());
    if (rows.length === 0) continue;
    const tab = ENTITY_TO_TAB[entityName];
    const { idToRow } = remote[tab] ?? { idToRow: new Map<string, number>() };
    await client.upsertRows(spreadsheetId, tab, rows, idToRow);
  }
}

type Row = Record<string, unknown> & {
  id?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

function isNewer(remote: Row, local: Row | null): boolean {
  if (!local) return true;
  const r = String(remote.updated_at ?? '');
  const l = String(local.updated_at ?? '');
  return r > l; // tie → local wins
}

/** One sync pass: pull, LWW merge, push outbox. */
export async function syncNow(
  onConflict?: (c: SyncResult['conflicts'][number]) => void,
  client: SheetsClient = defaultClient
): Promise<SyncResult> {
  const spreadsheetId = await getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Not connected');
  if (await isSampleActive()) throw new Error('Sample data is loaded. Clear it before syncing.');

  const lastSynced = (await getSetting(LAST_SYNC_KEY)) ?? new Date(0).toISOString();
  const result: SyncResult = { pulled: 0, pushed: 0, conflicts: [] };

  // One batch read per sync — the id→row maps are reused for the push below.
  const remote = await client.readAllTabs(spreadsheetId);

  for (const entityName of SYNCABLE) {
    const repo = new IdbRepository(entityName);
    const tab = ENTITY_TO_TAB[entityName];
    const remoteRows = remote[tab]?.rows ?? [];
    for (const { entity } of remoteRows) {
      const row = entity as Row;
      if (!row.id) continue;
      const local = await repo.getRaw(row.id);
      if (local?.deleted_at && !row.deleted_at && String(row.updated_at) > lastSynced) {
        // Local delete vs newer remote update: remote wins, toast.
        await repo.applyRemote({ ...row, deleted_at: null } as never);
        result.conflicts.push({ entity: entityName, id: row.id, kept: 'remote' });
        onConflict?.({ entity: entityName, id: row.id, kept: 'remote' });
        continue;
      }
      if (!local || isNewer(row, local)) {
        await repo.applyRemote(row as never);
        result.pulled++;
      } else if (row.deleted_at && !local.deleted_at) {
        await repo.applyRemote(row as never);
        result.pulled++;
      }
    }
  }

  // Push the outbox in order, reusing the pull's id→row maps.
  const outbox = await getOutbox();
  const byTab = new Map<TabName, Row[]>();
  for (const entry of outbox) {
    const tab = ENTITY_TO_TAB[entry.entity as EntityName];
    if (!tab) continue;
    const list = byTab.get(tab) ?? [];
    list.push(entry.payload as Row);
    byTab.set(tab, list);
  }
  for (const [tab, rows] of byTab) {
    const { appended } = await client.upsertRows(
      spreadsheetId,
      tab,
      rows,
      remote[tab].idToRow
    );
    result.pushed += rows.length;
    // Appends (and soft-deleted new rows) change the row layout: rebuild the map.
    if (appended > 0) {
      remote[tab] = await client.readTab(spreadsheetId, tab);
    }
  }
  await markOutboxSynced(outbox.map((e) => e.id));
  await setSetting(LAST_SYNC_KEY, new Date().toISOString());
  return result;
}
