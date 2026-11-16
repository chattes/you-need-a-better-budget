import { describe, expect, it } from 'vitest';
import {
  budgetProgress,
  carriedBalance,
  categoryAvailable,
  categoryBudget,
  categorySpent,
  goalEstimate,
  groupBudget,
  monthlyEquivalent,
  paysPerMonth,
  plannedIncome,
  remaining,
  setAside,
  spentInMonth,
  totalBudgeted,
  overBudget
} from '$lib/domain/budget';
import { applySplitsToActivity, validateSplit } from '$lib/domain/splits';
import { calculateDebtPayoffPlan } from '$lib/domain/goals';
import type { Goal, Transaction } from '$lib/domain/types';
import {
  DEVICE,

  category,
  group,
  incomePlan,
  makeId,
  monthBudget,
  NOW,
  transaction
} from './fixtures';

/**
 * Spec v2 worked examples (docs/study.md §4), encoded as fixtures:
 * planned income $4,500, total budgeted $4,710, spent $3,749.96,
 * set aside $110, remaining $640.04, budget progress 105% ($210 over).
 */

const MONTH = '2026-11';

describe('planned income (formula 1)', () => {
  it('fixed: $2,250 per pay × twice monthly = $4,500', () => {
    const plans = [incomePlan({ mode: 'fixed', pay_amount: 225_000, frequency: 'twice_monthly' })];
    expect(plannedIncome(plans, [], MONTH)).toBe(450_000);
  });

  it('pays per month: once 1, twice 2, biweekly 26/12, weekly 52/12', () => {
    expect(paysPerMonth('once_monthly')).toBe(1);
    expect(paysPerMonth('twice_monthly')).toBe(2);
    expect(paysPerMonth('biweekly')).toBeCloseTo(26 / 12, 6);
    expect(paysPerMonth('weekly')).toBeCloseTo(52 / 12, 6);
  });

  it('variable mode = income actually received that month', () => {
    const plans = [incomePlan({ mode: 'variable' })];
    const txs: Transaction[] = [
      transaction({ type: 'income', amount: 200_000, date: '2026-11-05' }),
      transaction({ type: 'income', amount: 100_000, date: '2026-11-19' }),
      transaction({ type: 'income', amount: 999_000, date: '2026-12-01' })
    ];
    expect(plannedIncome(plans, txs, MONTH)).toBe(300_000);
  });

  it('a plan persists until replaced by a later one', () => {
    const plans = [
      incomePlan({ month: '2026-11', pay_amount: 225_000 }),
      incomePlan({ month: '2027-01', pay_amount: 300_000 })
    ];
    expect(plannedIncome(plans, [], '2026-12')).toBe(450_000);
    expect(plannedIncome(plans, [], '2027-01')).toBe(600_000);
  });
});

describe('spent (formula 3)', () => {
  it('excludes transfers, reimbursements, refunds and excluded rows', () => {
    const txs: Transaction[] = [
      transaction({ amount: -150_000, date: '2026-11-02' }),
      transaction({ amount: -120_000, date: '2026-11-09' }),
      transaction({ amount: -20_000, date: '2026-11-11', type: 'transfer' }),
      transaction({
        amount: -10_000,
        date: '2026-11-12',
        transfer_pair_id: 'pair-1'
      }),
      transaction({ amount: -5_000, date: '2026-11-13', type: 'reimbursement' }),
      transaction({ amount: -4_000, date: '2026-11-14', type: 'refund' }),
      transaction({ amount: -3_000, date: '2026-11-15', excluded_from_budget: true }),
      transaction({ amount: -99_000, date: '2026-12-01' })
    ];
    expect(spentInMonth(txs, MONTH)).toBe(270_000);
  });

  it('the observed example: $3,749.96 spent, $200 transfer excluded', () => {
    const txs: Transaction[] = [
      transaction({ amount: -374_996, date: '2026-11-10' }),
      transaction({ amount: -20_000, date: '2026-11-10', type: 'transfer' })
    ];
    expect(spentInMonth(txs, MONTH)).toBe(374_996);
  });

  it('split rows do not double count', () => {
    const parent = transaction({ amount: -12_000, is_split: true });
    const child = transaction({ amount: -12_000, split_parent_id: parent.id });
    expect(spentInMonth([parent, child], MONTH)).toBe(12_000);
  });
});

describe('set aside (formula 4) and remaining (formula 5)', () => {
  it('set aside = Σ max(0, budget − spent) over rolls-over categories only', () => {
    const emergency = category({
      name: 'Emergency',
      monthly_target: 15_000,
      rollover_mode: 'rolls_over'
    });
    const groceries = category({
      name: 'Groceries',
      monthly_target: 20_000,
      rollover_mode: 'starts_fresh'
    });
    const txs = [
      transaction({ category_id: emergency.id, amount: -4_000, date: '2026-11-06' }),
      transaction({ category_id: groceries.id, amount: -10_000, date: '2026-11-06' })
    ];
    // Emergency 150 − 40 = 110 set aside; groceries starts fresh → not counted.
    expect(setAside([emergency, groceries], txs, [], MONTH, 450_000)).toBe(11_000);
  });

  it('remaining = planned − spent − set aside = 4,500 − 3,749.96 − 110 = 640.04', () => {
    expect(remaining(450_000, 374_996, 11_000)).toBe(64_004);
  });
});

describe('budget progress (formula 6)', () => {
  it('$4,710 budgeted ÷ $4,500 planned = 105%, $210 over', () => {
    const p = budgetProgress(471_000, 450_000);
    expect(p.percent).toBe(105);
    expect(p.over).toBe(21_000);
    expect(p.left).toBe(0);
  });

  it('under budget reports the amount left', () => {
    const p = budgetProgress(400_000, 450_000);
    expect(p.percent).toBe(89);
    expect(p.over).toBe(0);
    expect(p.left).toBe(50_000);
  });

  it('total budgeted sums category budgets', () => {
    const cats = [
      category({ monthly_target: 218_000 }),
      category({ monthly_target: 60_000 }),
      category({ monthly_target: null, target_percent: 10 })
    ];
    expect(totalBudgeted(cats, MONTH, [], 450_000)).toBe(218_000 + 60_000 + 45_000);
  });
});

describe('rollover (formula 7)', () => {
  it('rolls over: Emergency Nov budget 150, spent 40 → carried 110; Dec available = 110 + 150 = 260', () => {
    const emergency = category({
      name: 'Emergency',
      monthly_target: 15_000,
      rollover_mode: 'rolls_over'
    });
    const txs = [
      transaction({ category_id: emergency.id, amount: -4_000, date: '2026-11-06' })
    ];
    const planned = () => 450_000;
    const carried = carriedBalance(emergency, txs, [], '2026-12', planned);
    expect(carried).toBe(11_000);
    expect(categoryAvailable(emergency, txs, [], '2026-12', 450_000, carried)).toBe(26_000);
  });

  it('starts fresh: Groceries Nov budget 200, spent 140 → Dec available = 200 (no carry)', () => {
    const groceries = category({
      name: 'Groceries',
      monthly_target: 20_000,
      rollover_mode: 'starts_fresh'
    });
    const txs = [
      transaction({ category_id: groceries.id, amount: -14_000, date: '2026-11-06' })
    ];
    const carried = carriedBalance(groceries, txs, [], '2026-12', () => 450_000);
    expect(carried).toBe(0);
    expect(categoryAvailable(groceries, txs, [], '2026-12', 450_000, carried)).toBe(20_000);
  });

  it('overspent rollover months carry nothing (max(0, …) per month)', () => {
    const c = category({ monthly_target: 10_000, rollover_mode: 'rolls_over' });
    const txs = [transaction({ category_id: c.id, amount: -25_000, date: '2026-11-06' })];
    expect(carriedBalance(c, txs, [], '2026-12', () => 450_000)).toBe(0);
    expect(categoryAvailable(c, txs, [], '2026-12', 450_000, 0)).toBe(10_000);
  });
});

describe('group budget (formula 8)', () => {
  it('sums category budgets when no explicit group budget is set', () => {
    const g = group({ name: 'Housing' });
    const rent = category({ group_id: g.id, monthly_target: 180_000 });
    const utilities = category({ group_id: g.id, monthly_target: 38_000 });
    expect(groupBudget(g, [rent, utilities], MONTH, [], 450_000)).toBe(218_000);
  });

  it('an explicit group budget wins over the sum', () => {
    const g = group({ name: 'Housing', budget: 200_000 });
    const rent = category({ group_id: g.id, monthly_target: 180_000 });
    expect(groupBudget(g, [rent], MONTH, [], 450_000)).toBe(200_000);
  });
});

describe('goal estimate (formula 9)', () => {
  it('$750 target at $100/mo from Nov 2026 → 8 months → July 2027', () => {
    const est = goalEstimate(
      { target_amount: 75_000, saved_so_far: 0, monthly_contribution: 10_000 },
      '2026-11'
    );
    expect(est.months).toBe(8);
    expect(est.completionMonth).toBe('2027-07');
  });

  it('no monthly contribution → no estimate', () => {
    const est = goalEstimate(
      { target_amount: 75_000, saved_so_far: 0, monthly_contribution: 0 },
      '2026-11'
    );
    expect(est.completionMonth).toBeNull();
  });
});

describe('over-budget state', () => {
  it('Dining: budget $100, spent $150 → $50 over, 50% past budget', () => {
    const o = overBudget(10_000, 15_000);
    expect(o.over).toBe(true);
    expect(o.amount).toBe(5_000);
    expect(o.percent).toBe(50);
  });

  it('budget $600, spent $669.78 → 12% past', () => {
    const o = overBudget(60_000, 66_978);
    expect(o.over).toBe(true);
    expect(o.percent).toBe(12);
  });

  it('within budget is not over', () => {
    expect(overBudget(60_000, 60_000).over).toBe(false);
  });
});

describe('categoryBudget resolution order', () => {
  it('month override > % of income > fixed target (cadence-converted)', () => {
    const c = category({ monthly_target: 10_000, target_percent: 10 });
    const row = monthBudget({ month: MONTH, category_id: c.id, budgeted: 99_000 });
    expect(categoryBudget(c, MONTH, [row], 450_000)).toBe(99_000);
    expect(categoryBudget(c, MONTH, [], 450_000)).toBe(45_000);
    expect(categoryBudget({ ...c, target_percent: null }, MONTH, [], 450_000)).toBe(10_000);
  });

  it('not-budgeted category has a $0 budget', () => {
    const c = category({ monthly_target: null, target_percent: null });
    expect(categoryBudget(c, MONTH, [], 450_000)).toBe(0);
  });

  it('this-month-only categories count only in their duration month', () => {
    const c = category({
      monthly_target: 10_000,
      duration: 'this_month_only',
      duration_month: '2026-11'
    });
    expect(categoryBudget(c, '2026-11', [], 450_000)).toBe(10_000);
    expect(categoryBudget(c, '2026-12', [], 450_000)).toBe(0);
  });

  it('cadence conversion: yearly target ÷ 12, quarterly ÷ 3', () => {
    expect(monthlyEquivalent(120_000, 'yearly')).toBe(10_000);
    expect(monthlyEquivalent(30_000, 'quarterly')).toBe(10_000);
    expect(monthlyEquivalent(1_000, 'semimonthly')).toBe(2_000);
  });
});

describe('categorySpent', () => {
  it('sums expense rows for one category in the month', () => {
    const c = category({});
    const txs = [
      transaction({ category_id: c.id, amount: -5_000, date: '2026-11-02' }),
      transaction({ category_id: c.id, amount: -3_000, date: '2026-11-09' }),
      transaction({ category_id: c.id, amount: -99_000, date: '2026-12-01' }),
      transaction({ category_id: c.id, amount: -1_000, type: 'refund', date: '2026-11-10' })
    ];
    expect(categorySpent(txs, c.id, MONTH)).toBe(8_000);
  });
});

describe('splits', () => {
  it('validation passes when sums match', () => {
    const parent = transaction({ amount: -12_000, is_split: true });
    const splits = [
      { id: makeId(), parent_id: parent.id, category_id: 'a', amount: -8_000, memo: '' },
      { id: makeId(), parent_id: parent.id, category_id: 'b', amount: -4_000, memo: '' }
    ];
    expect(validateSplit(parent, splits)).toBe(true);
    const activity = applySplitsToActivity(splits);
    expect(activity.get('a')).toBe(8_000);
    expect(activity.get('b')).toBe(4_000);
  });

  it('validation fails when sums differ', () => {
    const parent = transaction({ amount: -12_000, is_split: true });
    const splits = [{ id: makeId(), parent_id: parent.id, category_id: 'a', amount: -8_000, memo: '' }];
    expect(validateSplit(parent, splits)).toBe(false);
  });

  it('expense parent makes typed magnitudes negative', async () => {
    const { normalizeSplitAmounts } = await import('$lib/domain/splits');
    expect(normalizeSplitAmounts(-5_000, [2_000, 3_000])).toEqual([-2_000, -3_000]);
  });

  it('income parent keeps magnitudes positive', async () => {
    const { normalizeSplitAmounts } = await import('$lib/domain/splits');
    expect(normalizeSplitAmounts(5_000, [2_000, 3_000])).toEqual([2_000, 3_000]);
  });
});

describe('goals (debt payoff)', () => {
  const debt = (id: string, balance: number, apr: number, min: number): Goal => ({
    id,
    name: id,
    type: 'debt_payoff',
    target_amount: balance,
    target_date: null,
    saved_so_far: 0,
    monthly_contribution: 0,
    description: '',
    linked_account_id: null,
    linked_category_id: null,
    debt_apr: apr,
    debt_min_payment: min,
    payoff_strategy: 'avalanche',
    created_at: NOW,
    updated_at: NOW,
    device_id: DEVICE,
    deleted_at: null
  });

  it('avalanche orders by APR desc', () => {
    const debts = [debt('low', 100_000, 500, 5_000), debt('high', 200_000, 2400, 10_000)];
    const plan = calculateDebtPayoffPlan(debts, 20_000, 'avalanche');
    expect(plan.order[0]!.debt_apr).toBeGreaterThanOrEqual(plan.order[1]!.debt_apr);
    expect(plan.monthsToFreedom).toBeGreaterThan(0);
    expect(plan.totalInterest).toBeGreaterThanOrEqual(0);
  });

  it('snowball orders by balance asc', () => {
    const debts = [debt('big', 500_000, 1000, 10_000), debt('small', 50_000, 3000, 5_000)];
    const plan = calculateDebtPayoffPlan(debts, 20_000, 'snowball');
    expect(plan.order[0]!.target_amount).toBeLessThanOrEqual(plan.order[1]!.target_amount);
  });
});
