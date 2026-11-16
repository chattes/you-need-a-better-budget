import type { Account, Category, MonthBudget, Period, Transaction } from './types';
import { categoryBudget, categorySpent, overBudget } from './budget';
import { isSplitParent } from './splits';

function inPeriod(t: Transaction, period: Period): boolean {
  return t.date >= period.start && t.date <= period.end && !t.deleted_at;
}

function isBudgetAccount(accounts: Account[], id: string): boolean {
  return accounts.find((a) => a.id === id)?.is_budget_account ?? false;
}

/**
 * Earned / Spent / Saved for a period (spec formulas 3 + reports section).
 * Spent excludes transfers, reimbursements, refunds and excluded-from-budget
 * rows. Saved = Earned − Spent.
 */
export function earnedSpentSaved(
  transactions: Transaction[],
  accounts: Account[],
  period: Period
): { earned: number; spent: number; saved: number } {
  let earned = 0;
  let spent = 0;
  for (const t of transactions) {
    if (!inPeriod(t, period) || isSplitParent(t)) continue;
    if (t.type === 'income' && t.amount > 0 && isBudgetAccount(accounts, t.account_id)) {
      earned += t.amount;
    } else if (
      t.type === 'expense' &&
      t.amount < 0 &&
      !t.excluded_from_budget &&
      !t.transfer_pair_id
    ) {
      spent += -t.amount;
    }
  }
  return { earned, spent, saved: earned - spent };
}

export interface BreakdownRow {
  id: string;
  name: string;
  amount: number;
  children?: BreakdownRow[];
}

/** Spending breakdown by group or category for a period (expenses only). */
export function spendingBreakdown(
  transactions: Transaction[],
  categories: Category[],
  groups: { id: string; name: string }[],
  period: Period,
  groupBy: 'group' | 'category'
): BreakdownRow[] {
  const perCategory = new Map<string, number>();
  for (const t of transactions) {
    if (!inPeriod(t, period)) continue;
    if (isSplitParent(t)) continue;
    if (t.type !== 'expense' || t.amount >= 0) continue;
    if (t.excluded_from_budget || t.transfer_pair_id) continue;
    if (!t.category_id) continue;
    perCategory.set(t.category_id, (perCategory.get(t.category_id) ?? 0) + -t.amount);
  }

  if (groupBy === 'category') {
    return categories
      .filter((c) => (perCategory.get(c.id) ?? 0) !== 0)
      .map((c) => ({ id: c.id, name: c.name, amount: perCategory.get(c.id) ?? 0 }))
      .sort((a, b) => b.amount - a.amount);
  }

  const rows: BreakdownRow[] = groups.map((g) => {
    const children = categories
      .filter((c) => c.group_id === g.id && (perCategory.get(c.id) ?? 0) !== 0)
      .map((c) => ({ id: c.id, name: c.name, amount: perCategory.get(c.id) ?? 0 }))
      .sort((a, b) => b.amount - a.amount);
    return {
      id: g.id,
      name: g.name,
      amount: children.reduce((s, c) => s + c.amount, 0),
      children
    };
  });
  return rows.filter((r) => r.amount !== 0).sort((a, b) => b.amount - a.amount);
}

export interface CashFlowPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

/** Per-month income/spent/net series over a period. */
export function cashFlow(
  transactions: Transaction[],
  accounts: Account[],
  period: Period
): CashFlowPoint[] {
  const byMonth = new Map<string, CashFlowPoint>();
  for (const t of transactions) {
    if (!inPeriod(t, period)) continue;
    if (isSplitParent(t)) continue;
    if (!isBudgetAccount(accounts, t.account_id)) continue;
    const month = t.date.slice(0, 7);
    const point = byMonth.get(month) ?? { month, income: 0, expense: 0, net: 0 };
    if (t.type === 'income' && t.amount > 0) point.income += t.amount;
    else if (
      t.type === 'expense' &&
      t.amount < 0 &&
      !t.excluded_from_budget &&
      !t.transfer_pair_id
    )
      point.expense += -t.amount;
    byMonth.set(month, point);
  }
  const points = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const p of points) p.net = p.income - p.expense;
  return points;
}

export interface TroubleSpot {
  category: Category;
  budget: number;
  spent: number;
  overAmount: number;
  percentPast: number;
}

/** Categories over budget this month, with the over amount and % past budget. */
export function budgetTroubleSpots(
  categories: Category[],
  transactions: Transaction[],
  monthBudgets: MonthBudget[],
  month: string,
  planned: number
): TroubleSpot[] {
  const spots: TroubleSpot[] = [];
  for (const c of categories) {
    if (c.is_archived || c.deleted_at) continue;
    const budget = categoryBudget(c, month, monthBudgets, planned);
    const spent = categorySpent(transactions, c.id, month);
    const state = overBudget(budget, spent);
    if (state.over) {
      spots.push({ category: c, budget, spent, overAmount: state.amount, percentPast: state.percent });
    }
  }
  return spots.sort((a, b) => b.overAmount - a.overAmount);
}
