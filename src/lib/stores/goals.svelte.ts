import type { Goal, PayoffStrategy } from '$lib/domain/types';
import { calculateDebtPayoffPlan, calculateSavingsProgress } from '$lib/domain/goals';
import { IdbRepository, makeEntityId } from '$lib/storage/indexeddb';
import { getDeviceId, nowIso } from '$lib/utils/date';

const repo = new IdbRepository<Goal>('goals');

function createGoalsStore() {
  let goals = $state<Goal[]>([]);

  async function load() {
    goals = await repo.getAll();
  }

  async function add(input: {
    name: string;
    type: 'savings' | 'debt_payoff';
    target_amount: number;
    target_date?: string | null;
    saved_so_far?: number;
    monthly_contribution?: number;
    description?: string;
    linked_category_id?: string | null;
    debt_apr?: number;
    debt_min_payment?: number;
    payoff_strategy?: PayoffStrategy;
  }): Promise<Goal> {
    const now = nowIso();
    const goal: Goal = {
      id: makeEntityId(),
      name: input.name.trim(),
      type: input.type,
      target_amount: input.target_amount,
      target_date: input.target_date ?? null,
      saved_so_far: input.saved_so_far ?? 0,
      monthly_contribution: input.monthly_contribution ?? 0,
      description: input.description ?? '',
      linked_account_id: null,
      linked_category_id: input.linked_category_id ?? null,
      debt_apr: input.debt_apr ?? 0,
      debt_min_payment: input.debt_min_payment ?? 0,
      payoff_strategy: input.payoff_strategy ?? 'avalanche',
      created_at: now,
      updated_at: now,
      device_id: getDeviceId(),
      deleted_at: null
    };
    await repo.upsert(goal);
    goals = [...goals, goal];
    return goal;
  }

  async function update(id: string, patch: Partial<Goal>): Promise<void> {
    const existing = goals.find((g) => g.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch, id, updated_at: nowIso(), device_id: getDeviceId() };
    await repo.upsert(next);
    goals = goals.map((g) => (g.id === id ? next : g));
  }

  async function contribute(id: string, amount: number): Promise<void> {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    await update(id, { saved_so_far: goal.saved_so_far + amount });
  }

  async function remove(id: string): Promise<void> {
    await repo.delete(id);
    goals = goals.filter((g) => g.id !== id);
  }

  return {
    get goals() {
      return goals;
    },
    get savings() {
      return goals.filter((g) => g.type === 'savings');
    },
    get debts() {
      return goals.filter((g) => g.type === 'debt_payoff');
    },
    progress: calculateSavingsProgress,
    payoffPlan: calculateDebtPayoffPlan,
    load,
    add,
    update,
    contribute,
    remove
  };
}

export const goalsStore = createGoalsStore();
