import type { Subscription, SubscriptionCadence } from '$lib/domain/types';
import { IdbRepository, makeEntityId } from '$lib/storage/indexeddb';
import { getDeviceId, nowIso } from '$lib/utils/date';

const repo = new IdbRepository<Subscription>('subscriptions');

function createSubscriptionsStore() {
  let subs = $state<Subscription[]>([]);

  async function load() {
    subs = (await repo.getAll()).sort((a, b) => a.next_charge_date.localeCompare(b.next_charge_date));
  }

  async function add(input: {
    merchant_name: string;
    amount: number;
    cadence: SubscriptionCadence;
    next_charge_date: string;
    category_id?: string | null;
    account_id?: string | null;
  }): Promise<Subscription> {
    const now = nowIso();
    const row: Subscription = {
      id: makeEntityId(),
      merchant_name: input.merchant_name.trim(),
      amount: input.amount,
      cadence: input.cadence,
      next_charge_date: input.next_charge_date,
      category_id: input.category_id ?? null,
      account_id: input.account_id ?? null,
      is_detected: false,
      created_at: now,
      updated_at: now,
      device_id: getDeviceId(),
      deleted_at: null
    };
    await repo.upsert(row);
    subs = [...subs, row].sort((a, b) => a.next_charge_date.localeCompare(b.next_charge_date));
    return row;
  }

  async function remove(id: string): Promise<void> {
    await repo.delete(id);
    subs = subs.filter((s) => s.id !== id);
  }

  return {
    get subscriptions() {
      return subs;
    },
    load,
    add,
    remove
  };
}

export const subscriptionsStore = createSubscriptionsStore();
