// Google Sheets backend: tab serialization, batch reads/writes, id→row map.
import { googleFetch } from './auth';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export const TABS = [
  'Accounts',
  'Groups',
  'Categories',
  'Transactions',
  'Payees',
  'MonthBudgets',
  'IncomePlan',
  'Goals',
  'Subscriptions',
  'RepeatRules',
  'Rules',
  'Tags',
  'Settings',
  'Snapshots'
] as const;

export type TabName = (typeof TABS)[number];

/**
 * Sheet tab headers (docs/study.md §5). Header names are the sheet contract;
 * money columns end in `_cents` and debt APR in `_bps`.
 */
export const HEADERS: Record<TabName, string[]> = {
  Accounts: [
    'id', 'name', 'type', 'balance_cents', 'currency', 'is_budget_account', 'is_closed',
    'sort_order', 'is_hidden', 'asset_kind', 'liability_kind', 'apr_bps', 'min_payment_cents',
    'created_at', 'updated_at', 'deleted_at', 'device_id'
  ],
  Groups: [
    'id', 'name', 'icon', 'color', 'sort_order', 'is_collapsed', 'budget_cents',
    'created_at', 'updated_at', 'deleted_at', 'device_id'
  ],
  Categories: [
    'id', 'group_id', 'name', 'icon', 'color', 'monthly_target_cents',
    'target_percent_of_income', 'cadence', 'due_day', 'rollover_mode', 'duration',
    'duration_month', 'note', 'goal_id', 'is_archived', 'sort_order', 'created_at',
    'updated_at', 'deleted_at', 'device_id'
  ],
  Transactions: [
    'id', 'date', 'amount_cents', 'payee_id', 'category_id', 'account_id', 'goal_id', 'type',
    'description', 'notes', 'tags', 'is_split', 'split_parent_id', 'transfer_pair_id',
    'excluded_from_budget', 'repeat_rule_id', 'import_id', 'created_at', 'updated_at',
    'deleted_at', 'device_id'
  ],
  Payees: [
    'id', 'name', 'default_category_id', 'renaming_rule', 'created_at', 'updated_at',
    'deleted_at', 'device_id'
  ],
  MonthBudgets: [
    'id', 'month', 'category_id', 'budgeted_cents', 'created_at', 'updated_at', 'deleted_at',
    'device_id'
  ],
  IncomePlan: [
    'id', 'month', 'mode', 'pay_amount_cents', 'frequency', 'pay_day', 'note', 'created_at',
    'updated_at', 'deleted_at', 'device_id'
  ],
  Goals: [
    'id', 'name', 'type', 'target_amount_cents', 'target_date', 'saved_so_far_cents',
    'monthly_contribution_cents', 'description', 'linked_account_id', 'linked_category_id',
    'debt_apr_bps', 'debt_min_payment_cents', 'payoff_strategy', 'created_at', 'updated_at',
    'deleted_at', 'device_id'
  ],
  Subscriptions: [
    'id', 'merchant_name', 'amount_cents', 'cadence', 'next_charge_date', 'category_id',
    'account_id', 'is_detected', 'created_at', 'updated_at', 'deleted_at', 'device_id'
  ],
  RepeatRules: [
    'id', 'name', 'amount_cents', 'payee_id', 'category_id', 'account_id', 'cadence', 'next_date',
    'end_date', 'is_active', 'created_at', 'updated_at', 'deleted_at', 'device_id'
  ],
  Rules: [
    'id', 'merchant_pattern', 'category_id', 'source', 'match_count', 'last_matched_at',
    'created_at', 'updated_at', 'deleted_at', 'device_id'
  ],
  Tags: ['id', 'name', 'color', 'created_at', 'updated_at', 'deleted_at', 'device_id'],
  Settings: ['key', 'value', 'updated_at'],
  Snapshots: ['date', 'assets', 'liabilities', 'net_worth', 'by_account_json', 'created_at']
};

export interface SheetRow {
  row: number; // 1-based, including header
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: Record<string, any>;
}

function toCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * In-memory field name for a sheet header. Only the money/rate columns that
 * the spec names with a unit suffix differ from the domain field names.
 */
const HEADER_TO_FIELD: Partial<Record<TabName, Record<string, string>>> = {
  Accounts: { balance_cents: 'balance', min_payment_cents: 'min_payment' },
  Groups: { budget_cents: 'budget' },
  Categories: {
    monthly_target_cents: 'monthly_target',
    target_percent_of_income: 'target_percent'
  },
  Transactions: { amount_cents: 'amount' },
  MonthBudgets: { budgeted_cents: 'budgeted' },
  IncomePlan: { pay_amount_cents: 'pay_amount' },
  Goals: {
    target_amount_cents: 'target_amount',
    saved_so_far_cents: 'saved_so_far',
    monthly_contribution_cents: 'monthly_contribution',
    debt_apr_bps: 'debt_apr',
    debt_min_payment_cents: 'debt_min_payment'
  },
  Subscriptions: { amount_cents: 'amount' },
  RepeatRules: { amount_cents: 'amount' }
};

export function fieldForHeader(tab: TabName, header: string): string {
  return HEADER_TO_FIELD[tab]?.[header] ?? header;
}

const NUMERIC_NAMES = new Set([
  'sort_order',
  'due_day',
  'target_percent_of_income',
  'pay_day',
  'assets',
  'liabilities',
  'net_worth',
  'match_count'
]);

function isNumericHeader(header: string): boolean {
  return /(_cents|_bps)$/.test(header) || NUMERIC_NAMES.has(header);
}

export function fromCell(header: string, raw: string): unknown {
  if (raw === '') return null;
  if (raw === 'TRUE') return true;
  if (raw === 'FALSE') return false;
  if (isNumericHeader(header)) {
    return Number(raw);
  }
  if (header === 'tags' || header === 'by_account_json') {
    try {
      return JSON.parse(raw);
    } catch {
      return header === 'tags' ? [] : null;
    }
  }
  return raw;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize(tab: TabName, entity: Record<string, any>): string[] {
  return HEADERS[tab].map((h) => toCell(entity[fieldForHeader(tab, h)]));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await googleFetch(`${SHEETS_API}${path}`, init);
  if (!response.ok) throw new Error(`Sheets API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

/** Creates the "YNBB Budget" spreadsheet with all tabs + header rows. */
export async function createSpreadsheet(): Promise<string> {
  const create = await googleFetch(DRIVE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'YNBB Budget',
      mimeType: 'application/vnd.google-apps.spreadsheet'
    })
  });
  if (!create.ok) throw new Error(`Drive create failed: ${await create.text()}`);
  const { id } = (await create.json()) as { id: string };

  // Add the non-default tabs.
  const spreadsheet = await api<{ sheets: Array<{ properties: { title: string } }> }>(
    `/${id}?fields=sheets.properties.title`
  );
  const existing = new Set(spreadsheet.sheets.map((s) => s.properties.title));
  const requests = TABS.filter((t) => !existing.has(t)).map((title) => ({
    addSheet: { properties: { title } }
  }));
  if (requests.length > 0) {
    await api(`/${id}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
  }

  // Write header rows.
  await api(`/${id}/values:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: TABS.map((tab) => ({
        range: `'${tab}'!A1`,
        values: [HEADERS[tab]]
      }))
    })
  });
  return id;
}

export interface TabData {
  rows: SheetRow[];
  idToRow: Map<string, number>;
}

export function parseTab(tab: TabName, values: string[][]): TabData {
  const headers = values[0] ?? HEADERS[tab];
  const rows: SheetRow[] = [];
  const idToRow = new Map<string, number>();
  for (let i = 1; i < values.length; i++) {
    const cells = values[i]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity: Record<string, any> = {};
    headers.forEach((h, idx) => {
      entity[fieldForHeader(tab, h)] = fromCell(h, cells[idx] ?? '');
    });
    const row = i + 1;
    rows.push({ row, entity });
    if (typeof entity.id === 'string' && entity.id) idToRow.set(entity.id, row);
    else if (tab === 'Settings' && entity.key) idToRow.set(String(entity.key), row);
    else if (tab === 'Snapshots' && entity.date) idToRow.set(String(entity.date), row);
  }
  return { rows, idToRow };
}

/** Reads one tab; returns entities with their sheet row numbers and id→row map. */
export async function readTab(spreadsheetId: string, tab: TabName): Promise<TabData> {
  const data = await api<{ values?: string[][] }>(
    `/${spreadsheetId}/values/'${encodeURIComponent(tab)}'!A1:Z100000`
  );
  return parseTab(tab, data.values ?? []);
}

/** Upsert entities into a tab. Rows found in idToRow are updated in place; new ones appended. */
export async function upsertRows(
  spreadsheetId: string,
  tab: TabName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entities: Array<Record<string, any>>,
  idToRow: Map<string, number>
): Promise<{ updated: number; appended: number }> {
  if (entities.length === 0) return { updated: 0, appended: 0 };
  const updates: Array<{ range: string; values: string[][] }> = [];
  const appends: string[][] = [];
  for (const entity of entities) {
    const key = String(entity.id ?? entity.key ?? entity.date ?? '');
    const row = key ? idToRow.get(key) : undefined;
    if (row) updates.push({ range: `'${tab}'!A${row}`, values: [serialize(tab, entity)] });
    else appends.push(serialize(tab, entity));
  }
  if (updates.length > 0) {
    await api(`/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data: updates })
    });
  }
  if (appends.length > 0) {
    await api(`/${spreadsheetId}/values/'${encodeURIComponent(tab)}'!A1:append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        values: appends
      })
    });
  }
  return { updated: updates.length, appended: appends.length };
}

/** Reads all entity tabs in one batchGet. */
export async function readAllTabs(spreadsheetId: string): Promise<Record<TabName, TabData>> {
  const ranges = TABS.map((t) => `'${t}'!A1:Z100000`).map(encodeURIComponent).join('&ranges=');
  const data = await api<{ valueRanges: Array<{ range: string; values?: string[][] }> }>(
    `/${spreadsheetId}/values:batchGet?ranges=${ranges}`
  );
  const result = {} as Record<TabName, TabData>;
  data.valueRanges.forEach((vr, idx) => {
    const tab = TABS[idx]!;
    result[tab] = parseTab(tab, vr.values ?? []);
  });
  return result;
}
