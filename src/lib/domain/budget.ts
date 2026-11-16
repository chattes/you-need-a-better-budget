import { isSplitParent } from './splits';
import type {
  Category,
  CategoryGroup,
  Goal,
  IncomePlan,
  MonthBudget,
  PayFrequency,
  Transaction
} from './types';

/**
 * Budget engine v2 (docs/study.md §4) — the inspiration's income + targets
 * model. Pure functions; every figure is derived from the income plan,
 * category targets and transactions. The envelope engine (Left to assign,
 * card payment rows, assignment carry rules) was removed in the v2 rebuild.
 */

/** Pays per month for a fixed pay frequency. */
export function paysPerMonth(frequency: PayFrequency): number {
  switch (frequency) {
    case 'once_monthly':
      return 1;
    case 'twice_monthly':
      return 2;
    case 'biweekly':
      return 26 / 12;
    case 'weekly':
      return 52 / 12;
  }
}

function liveRows(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => !t.deleted_at && !isSplitParent(t));
}

/** Rows that count toward Spent (spec formula 3): expenses, no transfers,
 * no reimbursements/refunds, nothing excluded from the budget. */
function spentRows(transactions: Transaction[]): Transaction[] {
  return liveRows(transactions).filter(
    (t) =>
      t.type === 'expense' &&
      t.amount < 0 &&
      !t.excluded_from_budget &&
      !t.transfer_pair_id
  );
}

/** Income received in a month (sum of income transactions). */
export function receivedIncome(transactions: Transaction[], month: string): number {
  let sum = 0;
  for (const t of liveRows(transactions)) {
    if (t.type === 'income' && t.amount > 0 && t.date.slice(0, 7) === month) sum += t.amount;
  }
  return sum;
}

/** The plan in effect for a month: exact row, else the most recent earlier
 * plan (plans persist until replaced). */
export function planForMonth(plans: IncomePlan[], month: string): IncomePlan | null {
  const applicable = plans
    .filter((p) => !p.deleted_at && p.month <= month)
    .sort((a, b) => b.month.localeCompare(a.month));
  return applicable[0] ?? null;
}

/** Formula 1: planned monthly income. Fixed = pay × pays/month. Variable (or
 * no plan) = the income actually received that month. */
export function plannedIncome(
  plans: IncomePlan[],
  transactions: Transaction[],
  month: string
): number {
  const plan = planForMonth(plans, month);
  if (!plan || plan.mode === 'variable') return receivedIncome(transactions, month);
  return Math.round(plan.pay_amount * paysPerMonth(plan.frequency));
}

/** Monthly-equivalent of a budget amount set with a non-monthly cadence. */
export function monthlyEquivalent(amount: number, cadence: Category['cadence']): number {
  switch (cadence) {
    case 'monthly':
      return amount;
    case 'weekly':
      return Math.round((amount * 52) / 12);
    case 'biweekly':
      return Math.round((amount * 26) / 12);
    case 'semimonthly':
      return amount * 2;
    case 'bimonthly':
      return Math.round(amount / 2);
    case 'quarterly':
      return Math.round(amount / 3);
    case 'yearly':
      return Math.round(amount / 12);
  }
}

/** A category's effective budget for a month: a per-month override
 * (MonthBudgets row) wins; then % of planned income; then the fixed target,
 * converted to its monthly equivalent. "This month only" categories count
 * only in their duration month. */
export function categoryBudget(
  category: Category,
  month: string,
  monthBudgets: MonthBudget[],
  planned: number
): number {
  if (category.duration === 'this_month_only' && category.duration_month !== month) return 0;
  const override = monthBudgets.find(
    (m) => !m.deleted_at && m.month === month && m.category_id === category.id
  );
  if (override) return override.budgeted;
  if (category.target_percent != null) return Math.round((planned * category.target_percent) / 100);
  if (category.monthly_target != null) return monthlyEquivalent(category.monthly_target, category.cadence);
  return 0;
}

/** Formula 3: Spent in a month (excludes transfers, reimbursements, refunds,
 * excluded-from-budget rows). */
export function spentInMonth(transactions: Transaction[], month: string): number {
  let sum = 0;
  for (const t of spentRows(transactions)) {
    if (t.date.slice(0, 7) === month) sum += -t.amount;
  }
  return sum;
}

/** Per-category Spent in a month (same exclusions). */
export function categorySpent(
  transactions: Transaction[],
  categoryId: string,
  month: string
): number {
  let sum = 0;
  for (const t of spentRows(transactions)) {
    if (t.category_id === categoryId && t.date.slice(0, 7) === month) sum += -t.amount;
  }
  return sum;
}

/** Formula 4: Set aside = Σ over rolls-over categories of
 * max(0, budget − spent) for the month. */
export function setAside(
  categories: Category[],
  transactions: Transaction[],
  monthBudgets: MonthBudget[],
  month: string,
  planned: number
): number {
  let sum = 0;
  for (const c of categories) {
    if (c.rollover_mode !== 'rolls_over' || c.is_archived || c.deleted_at) continue;
    const budget = categoryBudget(c, month, monthBudgets, planned);
    const spent = categorySpent(transactions, c.id, month);
    sum += Math.max(0, budget - spent);
  }
  return sum;
}

/** Formula 5: Remaining = planned income − spent − set aside. */
export function remaining(planned: number, spent: number, aside: number): number {
  return planned - spent - aside;
}

/** Formula 6: Budget Progress = total budgeted ÷ planned income. */
export function budgetProgress(
  totalBudgeted: number,
  planned: number
): { percent: number; over: number; left: number } {
  const percent = planned > 0 ? Math.round((totalBudgeted / planned) * 100) : 0;
  const diff = planned - totalBudgeted;
  return { percent, over: Math.max(0, -diff), left: Math.max(0, diff) };
}

/** Total budgeted across all categories for a month. */
export function totalBudgeted(
  categories: Category[],
  month: string,
  monthBudgets: MonthBudget[],
  planned: number
): number {
  let sum = 0;
  for (const c of categories) {
    if (c.is_archived || c.deleted_at) continue;
    sum += categoryBudget(c, month, monthBudgets, planned);
  }
  return sum;
}

/** Formula 7a: carried balance for a rolls-over category at the start of
 * `month` — walk month by month, carrying max(0, previous available). */
export function carriedBalance(
  category: Category,
  transactions: Transaction[],
  monthBudgets: MonthBudget[],
  month: string,
  plannedForMonth: (m: string) => number
): number {
  if (category.rollover_mode !== 'rolls_over') return 0;
  const months = new Set<string>();
  for (const t of liveRows(transactions)) months.add(t.date.slice(0, 7));
  for (const m of monthBudgets) if (!m.deleted_at) months.add(m.month);
  months.delete(month);
  const walk = [...months].filter((m) => m < month).sort();
  let carry = 0;
  for (const m of walk) {
    const budget = categoryBudget(category, m, monthBudgets, plannedForMonth(m));
    const spent = categorySpent(transactions, category.id, m);
    carry = Math.max(0, carry + budget - spent);
  }
  return carry;
}

/** A category's Available for the month. Rolls over: carried + budget −
 * spent (the carried amount is also shown as its own line). Starts fresh:
 * budget − spent. */
export function categoryAvailable(
  category: Category,
  transactions: Transaction[],
  monthBudgets: MonthBudget[],
  month: string,
  planned: number,
  carried = 0
): number {
  const budget = categoryBudget(category, month, monthBudgets, planned);
  const spent = categorySpent(transactions, category.id, month);
  const base = category.rollover_mode === 'rolls_over' ? carried + budget : budget;
  return base - spent;
}

/** Over-budget state: how much over and "% past budget". */
export function overBudget(
  budget: number,
  spent: number
): { over: boolean; amount: number; percent: number } {
  const amount = spent - budget;
  if (amount <= 0) return { over: false, amount: 0, percent: 0 };
  const percent = budget > 0 ? Math.round((amount / budget) * 100) : 100;
  return { over: true, amount, percent };
}

/** Formula 8: group budget — the explicit group budget when set, else the
 * sum of the group's category budgets. */
export function groupBudget(
  group: CategoryGroup,
  categories: Category[],
  month: string,
  monthBudgets: MonthBudget[],
  planned: number
): number {
  if (group.budget != null) return group.budget;
  let sum = 0;
  for (const c of categories) {
    if (c.group_id !== group.id || c.is_archived || c.deleted_at) continue;
    sum += categoryBudget(c, month, monthBudgets, planned);
  }
  return sum;
}

/** Formula 9: months to target = ceil((target − saved) ÷ monthly
 * contribution); completion = current month + that many months. */
export function goalEstimate(
  goal: Pick<Goal, 'target_amount' | 'saved_so_far' | 'monthly_contribution'>,
  fromMonth: string
): { months: number; completionMonth: string | null } {
  const remainingAmount = goal.target_amount - goal.saved_so_far;
  if (remainingAmount <= 0) return { months: 0, completionMonth: fromMonth };
  if (goal.monthly_contribution <= 0) return { months: Infinity, completionMonth: null };
  const months = Math.ceil(remainingAmount / goal.monthly_contribution);
  const [y, m] = fromMonth.split('-').map(Number);
  const completion = new Date(Date.UTC(y!, m! - 1 + months, 1));
  return { months, completionMonth: completion.toISOString().slice(0, 7) };
}

/**
 * Deterministic MonthBudget row id — one row per (month, category), so
 * repeated saves of the same budget update in place instead of inserting
 * duplicates.
 */
export function monthBudgetId(month: string, categoryId: string): string {
  return `${month}:${categoryId}`;
}

/**
 * Merge rows sharing (month, category) — legacy duplicate cleanup.
 * Keeps the row with the newest updated_at; returns the survivors and the
 * ids of the duplicates to delete.
 */
export function mergeDuplicateMonthBudgets(rows: MonthBudget[]): {
  merged: MonthBudget[];
  duplicateIds: string[];
} {
  const byKey = new Map<string, MonthBudget>();
  const duplicateIds: string[] = [];
  for (const row of rows) {
    const key = monthBudgetId(row.month, row.category_id);
    const existing = byKey.get(key);
    if (!existing || row.updated_at > existing.updated_at) {
      if (existing) duplicateIds.push(existing.id);
      byKey.set(key, row);
    } else {
      duplicateIds.push(row.id);
    }
  }
  return { merged: [...byKey.values()], duplicateIds };
}
