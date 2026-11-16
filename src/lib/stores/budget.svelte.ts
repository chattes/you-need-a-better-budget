import type { IncomePlan, MonthBudget } from '$lib/domain/types';
import {
  budgetProgress,
  carriedBalance,
  categoryAvailable,
  categoryBudget,
  categorySpent,
  mergeDuplicateMonthBudgets,
  monthBudgetId,
  planForMonth,
  plannedIncome,
  receivedIncome,
  remaining,
  setAside,
  spentInMonth,
  totalBudgeted
} from '$lib/domain/budget';
import { IdbRepository } from '$lib/storage/indexeddb';
import { categoriesStore } from './categories.svelte';
import { transactionsStore } from './transactions.svelte';
import { currentMonth, getDeviceId, nowIso } from '$lib/utils/date';

const budgetRepo = new IdbRepository<MonthBudget>('month_budgets');
const incomeRepo = new IdbRepository<IncomePlan>('income_plan');

/**
 * v2 income + targets model (docs/study.md §4). Stores only what the user
 * did: per-month budget overrides and the income plan. Every derived number
 * (planned income, spent, set aside, remaining, available, carried) comes
 * from the domain engine — never stored.
 */
function createBudgetStore() {
  let monthBudgets = $state<MonthBudget[]>([]);
  let incomePlans = $state<IncomePlan[]>([]);
  let month = $state(currentMonth());

  async function load() {
    const rows = await budgetRepo.getAll();
    const { merged, duplicateIds } = mergeDuplicateMonthBudgets(rows);
    monthBudgets = merged;
    for (const id of duplicateIds) await budgetRepo.delete(id);
    incomePlans = await incomeRepo.getAll();
  }

  function setMonth(next: string) {
    month = next;
  }

  function rowFor(categoryId: string, m: string = month): MonthBudget | undefined {
    return monthBudgets.find((b) => b.month === m && b.category_id === categoryId);
  }

  /** User action: set (override) a category's budget for the shown month. */
  async function setBudget(categoryId: string, amount: number, m: string = month): Promise<void> {
    const now = nowIso();
    const existing = rowFor(categoryId, m);
    if (existing) {
      const next: MonthBudget = {
        ...existing,
        budgeted: amount,
        updated_at: now,
        device_id: getDeviceId()
      };
      await budgetRepo.upsert(next);
      monthBudgets = monthBudgets.map((b) => (b.id === next.id ? next : b));
    } else {
      const row: MonthBudget = {
        id: monthBudgetId(m, categoryId),
        month: m,
        category_id: categoryId,
        budgeted: amount,
        created_at: now,
        updated_at: now,
        device_id: getDeviceId(),
        deleted_at: null
      };
      await budgetRepo.upsert(row);
      monthBudgets = [...monthBudgets, row];
    }
  }

  /** User action: set the income plan taking effect from the shown month. */
  async function setIncomePlan(input: {
    mode: IncomePlan['mode'];
    pay_amount: number;
    frequency: IncomePlan['frequency'];
    pay_day: number;
    note?: string;
  }): Promise<void> {
    const now = nowIso();
    const existing = incomePlans.find((p) => p.month === month);
    if (existing) {
      const next: IncomePlan = {
        ...existing,
        ...input,
        note: input.note ?? existing.note,
        updated_at: now,
        device_id: getDeviceId()
      };
      await incomeRepo.upsert(next);
      incomePlans = incomePlans.map((p) => (p.id === next.id ? next : p));
    } else {
      const row: IncomePlan = {
        id: crypto.randomUUID(),
        month,
        mode: input.mode,
        pay_amount: input.pay_amount,
        frequency: input.frequency,
        pay_day: input.pay_day,
        note: input.note ?? '',
        created_at: now,
        updated_at: now,
        device_id: getDeviceId(),
        deleted_at: null
      };
      await incomeRepo.upsert(row);
      incomePlans = [...incomePlans, row];
    }
  }

  /** Remove the income plan for a month (used by the dialog's variable mode reset). */
  async function clearIncomePlan(m: string = month): Promise<void> {
    const existing = incomePlans.find((p) => p.month === m);
    if (!existing) return;
    await incomeRepo.delete(existing.id);
    incomePlans = incomePlans.filter((p) => p.id !== existing.id);
  }

  const transactions = $derived(transactionsStore.transactions);
  const categories = $derived(categoriesStore.categories);

  const plan = $derived(planForMonth(incomePlans, month));
  const planned = $derived(plannedIncome(incomePlans, transactions, month));
  const received = $derived(receivedIncome(transactions, month));
  const spent = $derived(spentInMonth(transactions, month));
  const aside = $derived(setAside(categories, transactions, monthBudgets, month, planned));
  const remainingCents = $derived(remaining(planned, spent, aside));
  const budgeted = $derived(totalBudgeted(categories, month, monthBudgets, planned));
  const progress = $derived(budgetProgress(budgeted, planned));

  function budgetFor(categoryId: string, m: string = month): number {
    const c = categories.find((x) => x.id === categoryId);
    if (!c) return 0;
    return categoryBudget(c, m, monthBudgets, plannedIncome(incomePlans, transactions, m));
  }

  function carriedFor(categoryId: string, m: string = month): number {
    const c = categories.find((x) => x.id === categoryId);
    if (!c) return 0;
    return carriedBalance(c, transactions, monthBudgets, m, (mm) =>
      plannedIncome(incomePlans, transactions, mm)
    );
  }

  function availableFor(categoryId: string, m: string = month): number {
    const c = categories.find((x) => x.id === categoryId);
    if (!c) return 0;
    const plannedM = plannedIncome(incomePlans, transactions, m);
    return categoryAvailable(c, transactions, monthBudgets, m, plannedM, carriedFor(categoryId, m));
  }

  function spentFor(categoryId: string, m: string = month): number {
    return categorySpent(transactions, categoryId, m);
  }

  return {
    get monthBudgets() {
      return monthBudgets;
    },
    get incomePlans() {
      return incomePlans;
    },
    get month() {
      return month;
    },
    get plan() {
      return plan;
    },
    get planned() {
      return planned;
    },
    get received() {
      return received;
    },
    get spent() {
      return spent;
    },
    get setAside() {
      return aside;
    },
    get remaining() {
      return remainingCents;
    },
    get budgeted() {
      return budgeted;
    },
    get progress() {
      return progress;
    },
    load,
    setMonth,
    setBudget,
    setIncomePlan,
    clearIncomePlan,
    rowFor,
    budgetFor,
    carriedFor,
    availableFor,
    spentFor
  };
}

export const budgetStore = createBudgetStore();
