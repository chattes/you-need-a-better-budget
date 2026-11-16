import type { Transaction, TransactionType } from '$lib/domain/types';
import { validateSplit } from '$lib/domain/splits';
import { IdbRepository, makeEntityId } from '$lib/storage/indexeddb';
import { accountsStore } from './accounts.svelte';
import { getDeviceId, nowIso } from '$lib/utils/date';

const repo = new IdbRepository<Transaction>('transactions');

export interface TransactionInput {
  date: string;
  amount: number; // cents, signed per type convention by caller
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  description?: string;
  notes?: string;
  tags?: string[];
  payee_id?: string;
  goal_id?: string | null;
  excluded_from_budget?: boolean;
  repeat_rule_id?: string | null;
  import_id?: string;
}

function baseRow(input: TransactionInput): Transaction {
  const now = nowIso();
  return {
    id: makeEntityId(),
    date: input.date,
    amount: input.amount,
    payee_id: input.payee_id ?? '',
    category_id: input.category_id,
    account_id: input.account_id,
    goal_id: input.goal_id ?? null,
    type: input.type,
    description: input.description ?? '',
    notes: input.notes ?? '',
    tags: input.tags ?? [],
    is_split: false,
    split_parent_id: null,
    transfer_pair_id: null,
    excluded_from_budget: input.excluded_from_budget ?? false,
    repeat_rule_id: input.repeat_rule_id ?? null,
    import_id: input.import_id ?? '',
    created_at: now,
    updated_at: now,
    device_id: getDeviceId(),
    deleted_at: null
  };
}

/**
 * Writing a transaction only changes account balances. Every budget number
 * (planned income, spent, set aside, remaining, available) is derived by the
 * domain engine from the transaction list — no derived value is stored.
 */
function createTransactionsStore() {
  let transactions = $state<Transaction[]>([]);

  async function load() {
    transactions = (await repo.getAll()).sort((a, b) => b.date.localeCompare(a.date));
  }

  async function persist(row: Transaction): Promise<void> {
    await repo.upsert(row);
    transactions = [row, ...transactions];
  }

  async function adjustBalance(accountId: string, delta: number): Promise<void> {
    const account = accountsStore.accounts.find((a) => a.id === accountId);
    if (account) await accountsStore.update(accountId, { balance: account.balance + delta });
  }

  async function add(input: TransactionInput): Promise<Transaction> {
    const row = baseRow(input);
    await persist(row);
    await adjustBalance(row.account_id, row.amount);
    return row;
  }

  /** A transfer between any two accounts (e.g. a card payment). Transfers are
   * excluded from Spent/Received by the domain engine — never categorised. */
  async function addTransfer(input: {
    date: string;
    amount: number; // cents, positive
    from_account_id: string;
    to_account_id: string;
    description?: string;
  }): Promise<void> {
    const pairA = baseRow({
      date: input.date,
      amount: -Math.abs(input.amount),
      account_id: input.from_account_id,
      category_id: null,
      type: 'transfer',
      description: input.description ?? ''
    });
    const pairB = baseRow({
      date: input.date,
      amount: Math.abs(input.amount),
      account_id: input.to_account_id,
      category_id: null,
      type: 'transfer',
      description: input.description ?? ''
    });
    pairA.transfer_pair_id = pairB.id;
    pairB.transfer_pair_id = pairA.id;
    await persist(pairA);
    await persist(pairB);
    await adjustBalance(input.from_account_id, -Math.abs(input.amount));
    await adjustBalance(input.to_account_id, Math.abs(input.amount));
  }

  async function addSplit(
    parent: TransactionInput,
    splits: Array<{ category_id: string; amount: number; memo?: string }>
  ): Promise<Transaction | null> {
    const parentRow = { ...baseRow(parent), is_split: true, category_id: null };
    const splitRows = splits.map((s) => ({
      id: makeEntityId(),
      parent_id: parentRow.id,
      category_id: s.category_id,
      amount: s.amount,
      memo: s.memo ?? ''
    }));
    if (!validateSplit(parentRow, splitRows)) return null;
    await persist(parentRow);
    await adjustBalance(parentRow.account_id, parentRow.amount);
    for (const s of splitRows) {
      const child: Transaction = {
        ...baseRow({
          date: parentRow.date,
          amount: s.amount,
          account_id: parentRow.account_id,
          category_id: s.category_id,
          type: parentRow.type,
          description: s.memo || parentRow.description,
          payee_id: parentRow.payee_id
        }),
        is_split: true,
        split_parent_id: parentRow.id
      };
      await repo.upsert(child);
      transactions = [child, ...transactions];
    }
    return parentRow;
  }

  /** Split children carry no balance effect; the parent holds the whole amount. */
  const hasBalanceEffect = (t: Transaction) => !t.split_parent_id;

  async function update(id: string, patch: Partial<Transaction>): Promise<void> {
    const existing = transactions.find((t) => t.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch, id, updated_at: nowIso(), device_id: getDeviceId() };
    await repo.upsert(next);
    transactions = transactions.map((t) => (t.id === id ? next : t));
    if (hasBalanceEffect(existing)) {
      // Undo the old effect, apply the new one (amount or account may have changed).
      await adjustBalance(existing.account_id, -existing.amount);
      await adjustBalance(next.account_id, next.amount);
    }
  }

  /** Deletes a row, its split children, and a transfer's other leg; reverses balance effects. */
  async function remove(id: string): Promise<void> {
    const target = transactions.find((t) => t.id === id);
    if (!target) return;
    const ids = new Set<string>([id]);
    for (const t of transactions) {
      if (t.split_parent_id === id) ids.add(t.id);
    }
    if (target.transfer_pair_id) ids.add(target.transfer_pair_id);
    for (const rowId of ids) {
      const row = transactions.find((t) => t.id === rowId);
      if (!row) continue;
      if (hasBalanceEffect(row)) await adjustBalance(row.account_id, -row.amount);
      await repo.delete(rowId);
    }
    transactions = transactions.filter((t) => !ids.has(t.id));
  }

  async function importRows(rows: TransactionInput[]): Promise<number> {
    let imported = 0;
    for (const input of rows) {
      if (input.import_id && transactions.some((t) => t.import_id === input.import_id)) continue;
      await add(input);
      imported++;
    }
    return imported;
  }

  return {
    get transactions() {
      return transactions;
    },
    load,
    add,
    addTransfer,
    addSplit,
    update,
    remove,
    importRows
  };
}

export const transactionsStore = createTransactionsStore();
