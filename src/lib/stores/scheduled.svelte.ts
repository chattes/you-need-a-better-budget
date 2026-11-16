import type { RepeatRule, RepeatCadence } from '$lib/domain/types';
import { expandScheduled } from '$lib/domain/scheduled';
import { IdbRepository, makeEntityId } from '$lib/storage/indexeddb';
import { getDeviceId, nowIso } from '$lib/utils/date';

const repo = new IdbRepository<RepeatRule>('scheduled');

function createScheduledStore() {
  let scheduled = $state<RepeatRule[]>([]);

  async function load() {
    scheduled = await repo.getAll();
  }

  async function add(input: {
    name: string;
    amount: number;
    account_id: string;
    category_id: string;
    cadence: RepeatCadence;
    next_date: string;
    end_date?: string | null;
  }): Promise<RepeatRule> {
    const now = nowIso();
    const row: RepeatRule = {
      id: makeEntityId(),
      name: input.name.trim(),
      amount: input.amount,
      payee_id: '',
      category_id: input.category_id,
      account_id: input.account_id,
      cadence: input.cadence,
      next_date: input.next_date,
      end_date: input.end_date ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
      device_id: getDeviceId(),
      deleted_at: null
    };
    await repo.upsert(row);
    scheduled = [...scheduled, row];
    return row;
  }

  async function update(id: string, patch: Partial<RepeatRule>): Promise<void> {
    const existing = scheduled.find((s) => s.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch, id, updated_at: nowIso(), device_id: getDeviceId() };
    await repo.upsert(next);
    scheduled = scheduled.map((s) => (s.id === id ? next : s));
  }

  async function remove(id: string): Promise<void> {
    await repo.delete(id);
    scheduled = scheduled.filter((s) => s.id !== id);
  }

  return {
    get scheduled() {
      return scheduled;
    },
    get active() {
      return scheduled.filter((s) => s.is_active);
    },
    expand: (from: Date, to: Date) => expandScheduled(scheduled.filter((s) => s.is_active), from, to),
    load,
    add,
    update,
    remove
  };
}

export const scheduledStore = createScheduledStore();
