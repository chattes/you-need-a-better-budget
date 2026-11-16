import type { Account, AccountType } from '$lib/domain/types';
import { IdbRepository, makeEntityId } from '$lib/storage/indexeddb';
import { getDeviceId, nowIso } from '$lib/utils/date';

const repo = new IdbRepository<Account>('accounts');

function createAccountsStore() {
  let accounts = $state<Account[]>([]);
  let loaded = $state(false);

  async function load() {
    accounts = (await repo.getAll()).sort((a, b) => a.sort_order - b.sort_order);
    loaded = true;
  }

  async function add(input: {
    name: string;
    type: AccountType;
    balance: number;
    currency?: string;
    is_budget_account?: boolean;
  }): Promise<Account> {
    const now = nowIso();
    const account: Account = {
      id: makeEntityId(),
      name: input.name.trim(),
      type: input.type,
      balance: input.balance,
      currency: input.currency ?? 'CAD',
      is_budget_account:
        input.is_budget_account ?? ['chequing', 'savings', 'cash'].includes(input.type),
      is_closed: false,
      sort_order: accounts.length,
      created_at: now,
      updated_at: now,
      device_id: getDeviceId(),
      deleted_at: null
    };
    await repo.upsert(account);
    accounts = [...accounts, account];
    return account;
  }

  async function update(id: string, patch: Partial<Account>): Promise<void> {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) return;
    const next = {
      ...existing,
      ...patch,
      id,
      updated_at: nowIso(),
      device_id: getDeviceId()
    };
    await repo.upsert(next);
    accounts = accounts.map((a) => (a.id === id ? next : a));
  }

  async function remove(id: string): Promise<void> {
    await repo.delete(id);
    accounts = accounts.filter((a) => a.id !== id);
  }

  return {
    get accounts() {
      return accounts;
    },
    get loaded() {
      return loaded;
    },
    load,
    add,
    update,
    remove
  };
}

export const accountsStore = createAccountsStore();
