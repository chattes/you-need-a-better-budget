import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Account,
  CategorizationRule,
  Category,
  CategoryGroup,
  Goal,
  IncomePlan,
  MonthBudget,
  NetWorthSnapshot,
  Payee,
  RepeatRule,
  Subscription,
  Tag,
  Transaction
} from '$lib/domain/types';
import type { Change, OutboxEntry, Repository } from './repository';

export type EntityName =
  | 'accounts'
  | 'categories'
  | 'groups'
  | 'transactions'
  | 'month_budgets'
  | 'income_plan'
  | 'goals'
  | 'subscriptions'
  | 'scheduled'
  | 'rules'
  | 'tags'
  | 'payees';

interface YnbbDb extends DBSchema {
  accounts: { key: string; value: Account; indexes: { updated_at: string } };
  categories: { key: string; value: Category; indexes: { updated_at: string; group_id: string } };
  groups: { key: string; value: CategoryGroup; indexes: { updated_at: string } };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { updated_at: string; account_id: string; category_id: string; date: string };
  };
  month_budgets: {
    key: string;
    value: MonthBudget;
    indexes: { updated_at: string; month: string; category_id: string };
  };
  income_plan: { key: string; value: IncomePlan; indexes: { updated_at: string; month: string } };
  goals: { key: string; value: Goal; indexes: { updated_at: string } };
  subscriptions: { key: string; value: Subscription; indexes: { updated_at: string } };
  scheduled: { key: string; value: RepeatRule; indexes: { updated_at: string } };
  rules: { key: string; value: CategorizationRule; indexes: { updated_at: string } };
  tags: { key: string; value: Tag; indexes: { updated_at: string } };
  payees: { key: string; value: Payee; indexes: { updated_at: string } };
  settings: { key: string; value: { key: string; value: string; updated_at: string } };
  outbox: { key: string; value: OutboxEntry; indexes: { created_at: string } };
  snapshots: { key: string; value: NetWorthSnapshot };
}

const DB_NAME = 'ynbb';
// v2 (2026-11): income + targets model. The schema is incompatible with the
// v1 envelope model (MonthBudget fields, category fields, account types), and
// there are no production users yet, so the upgrade is a documented CLEAN
// RESET: all stores are dropped and recreated. See docs/plan.md (v2 rebuild).
const DB_VERSION = 2;
const RESET_NOTICE_KEY = 'ynbb:v2-reset-notice';

/** One-time notice flag: set when a v1 database was reset to v2. */
function markResetNotice(): void {
  try {
    localStorage.setItem(RESET_NOTICE_KEY, '1');
  } catch {
    // Storage blocked (private window): the notice is skipped, data reset still happens.
  }
}

/** Returns true once after a v1 → v2 reset, then clears the flag. */
export function takeResetNotice(): boolean {
  try {
    if (localStorage.getItem(RESET_NOTICE_KEY) !== '1') return false;
    localStorage.removeItem(RESET_NOTICE_KEY);
    return true;
  } catch {
    return false;
  }
}

let dbPromise: Promise<IDBPDatabase<YnbbDb>> | null = null;

export function getDb(): Promise<IDBPDatabase<YnbbDb>> {
  if (!dbPromise) {
    dbPromise = openDB<YnbbDb>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Clean reset: drop every existing store (any version), then create fresh.
        if (oldVersion > 0 && oldVersion < DB_VERSION) markResetNotice();
        for (const name of Array.from(db.objectStoreNames)) db.deleteObjectStore(name);

        db.createObjectStore('accounts', { keyPath: 'id' }).createIndex(
          'updated_at',
          'updated_at'
        );
        const categories = db.createObjectStore('categories', { keyPath: 'id' });
        categories.createIndex('updated_at', 'updated_at');
        categories.createIndex('group_id', 'group_id');
        db.createObjectStore('groups', { keyPath: 'id' }).createIndex(
          'updated_at',
          'updated_at'
        );
        const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
        transactions.createIndex('updated_at', 'updated_at');
        transactions.createIndex('account_id', 'account_id');
        transactions.createIndex('category_id', 'category_id');
        transactions.createIndex('date', 'date');
        const monthBudgets = db.createObjectStore('month_budgets', { keyPath: 'id' });
        monthBudgets.createIndex('updated_at', 'updated_at');
        monthBudgets.createIndex('month', 'month');
        monthBudgets.createIndex('category_id', 'category_id');
        const incomePlan = db.createObjectStore('income_plan', { keyPath: 'id' });
        incomePlan.createIndex('updated_at', 'updated_at');
        incomePlan.createIndex('month', 'month');
        db.createObjectStore('goals', { keyPath: 'id' }).createIndex('updated_at', 'updated_at');
        db.createObjectStore('subscriptions', { keyPath: 'id' }).createIndex(
          'updated_at',
          'updated_at'
        );
        db.createObjectStore('scheduled', { keyPath: 'id' }).createIndex(
          'updated_at',
          'updated_at'
        );
        db.createObjectStore('rules', { keyPath: 'id' }).createIndex('updated_at', 'updated_at');
        db.createObjectStore('tags', { keyPath: 'id' }).createIndex('updated_at', 'updated_at');
        db.createObjectStore('payees', { keyPath: 'id' }).createIndex('updated_at', 'updated_at');
        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('outbox', { keyPath: 'id' }).createIndex('created_at', 'created_at');
        db.createObjectStore('snapshots', { keyPath: 'date' });
      }
    });
  }
  return dbPromise;
}

type WithTimestamps = {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function makeOutboxEntry<T extends WithTimestamps>(
  entity: EntityName,
  operation: 'upsert' | 'delete',
  payload: T
): OutboxEntry {
  return {
    id: crypto.randomUUID(),
    entity,
    operation,
    payload,
    created_at: nowIso(),
    retries: 0,
    synced: false
  };
}

export class IdbRepository<T extends WithTimestamps> implements Repository<T> {
  constructor(private readonly entity: EntityName) {}

  async getAll(): Promise<T[]> {
    const db = await getDb();
    const all = (await db.getAll(this.entity)) as unknown as T[];
    return all.filter((e) => !e.deleted_at);
  }

  async getById(id: string): Promise<T | null> {
    const raw = await this.getRaw(id);
    if (!raw || raw.deleted_at) return null;
    return raw;
  }

  /** Like getById but includes soft-deleted rows (used by sync). */
  async getRaw(id: string): Promise<T | null> {
    const db = await getDb();
    return ((await db.get(this.entity, id)) as unknown as T | undefined) ?? null;
  }

  async upsert(entity: T): Promise<void> {
    const db = await getDb();
    const tx = db.transaction([this.entity, 'outbox'], 'readwrite');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tx.objectStore(this.entity).put(entity as any);
    await tx.objectStore('outbox').put(makeOutboxEntry(this.entity, 'upsert', entity));
    await tx.done;
  }

  async upsertMany(entities: T[]): Promise<void> {
    if (entities.length === 0) return;
    const db = await getDb();
    const tx = db.transaction([this.entity, 'outbox'], 'readwrite');
    for (const entity of entities) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.objectStore(this.entity).put(entity as any);
      await tx.objectStore('outbox').put(makeOutboxEntry(this.entity, 'upsert', entity));
    }
    await tx.done;
  }

  /** Soft delete: sets deleted_at and queues an outbox delete. */
  async delete(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction([this.entity, 'outbox'], 'readwrite');
    const existing = (await tx.objectStore(this.entity).get(id)) as unknown as T | undefined;
    if (existing) {
      const deleted = { ...existing, deleted_at: nowIso(), updated_at: nowIso() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.objectStore(this.entity).put(deleted as any);
      await tx.objectStore('outbox').put(makeOutboxEntry(this.entity, 'delete', deleted));
    }
    await tx.done;
  }

  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) await this.delete(id);
  }

  /** Applies a remote change without queueing an outbox entry. */
  async applyRemote(entity: T): Promise<void> {
    const db = await getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.put(this.entity, entity as any);
  }

  async getSince(timestamp: string): Promise<T[]> {
    const db = await getDb();
    const rows = (await db.getAll(this.entity)) as unknown as T[];
    return rows.filter((r) => r.updated_at > timestamp);
  }

  async getChangesSince(timestamp: string): Promise<Change[]> {
    const rows = await this.getSince(timestamp);
    return rows.map((r) => ({
      entity: this.entity,
      id: r.id,
      operation: r.deleted_at ? ('delete' as const) : ('upsert' as const),
      data: r,
      updated_at: r.updated_at
    }));
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.get('settings', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.put('settings', { key, value, updated_at: nowIso() });
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  const db = await getDb();
  const all = await db.getAll('outbox');
  return all.filter((e) => !e.synced);
}

export async function markOutboxSynced(ids: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('outbox', 'readwrite');
  for (const id of ids) {
    const entry = await tx.store.get(id);
    if (entry) await tx.store.put({ ...entry, synced: true });
  }
  await tx.done;
}

export async function incrementOutboxRetries(ids: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('outbox', 'readwrite');
  for (const id of ids) {
    const entry = await tx.store.get(id);
    if (entry) await tx.store.put({ ...entry, retries: entry.retries + 1 });
  }
  await tx.done;
}

export async function saveSnapshot(snapshot: NetWorthSnapshot): Promise<void> {
  const db = await getDb();
  await db.put('snapshots', snapshot);
}

export async function getSnapshots(): Promise<NetWorthSnapshot[]> {
  const db = await getDb();
  return db.getAll('snapshots');
}

export function makeEntityId(): string {
  return crypto.randomUUID();
}
