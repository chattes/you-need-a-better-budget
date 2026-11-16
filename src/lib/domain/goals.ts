import type { Goal } from './types';
import { goalEstimate } from './budget';

/** Savings progress: percent toward target and projected completion (spec
 * formula 9: ceil(remaining ÷ monthly contribution) months from now). */
export function calculateSavingsProgress(
  goal: Goal,
  asOf: Date = new Date()
): { percent: number; monthlyNeeded: number; completionMonth: string | null } {
  const percent =
    goal.target_amount > 0
      ? Math.min(100, (goal.saved_so_far / goal.target_amount) * 100)
      : 100;
  const fromMonth = asOf.toISOString().slice(0, 7);
  const { completionMonth } = goalEstimate(goal, fromMonth);
  const remainingAmount = Math.max(goal.target_amount - goal.saved_so_far, 0);
  let monthlyNeeded = goal.monthly_contribution;
  if (goal.target_date) {
    const target = new Date(goal.target_date + 'T00:00:00Z');
    const months =
      (target.getUTCFullYear() - asOf.getUTCFullYear()) * 12 +
      (target.getUTCMonth() - asOf.getUTCMonth());
    monthlyNeeded = Math.ceil(remainingAmount / Math.max(months, 1));
  }
  return { percent, monthlyNeeded, completionMonth };
}

function sortDebts(debts: Goal[], strategy: 'avalanche' | 'snowball'): Goal[] {
  const copy = [...debts];
  if (strategy === 'avalanche') copy.sort((a, b) => b.debt_apr - a.debt_apr);
  else copy.sort((a, b) => a.target_amount - b.target_amount);
  return copy;
}

export interface DebtPayoffPlan {
  order: Goal[];
  monthsToFreedom: number;
  totalInterest: number;
}

/**
 * Simulate payoff of `debts` (target_amount = balance owed, cents; debt_apr in
 * basis points) with `extraPayment` cents/month on top of minimum payments,
 * applied in strategy order. Extra rolls to the next debt as each is paid off.
 */
export function calculateDebtPayoffPlan(
  debts: Goal[],
  extraPayment: number,
  strategy: 'avalanche' | 'snowball' = 'avalanche'
): DebtPayoffPlan {
  const order = sortDebts(debts, strategy);
  if (order.length === 0) return { order, monthsToFreedom: 0, totalInterest: 0 };

  const balances = order.map((d) => Math.max(d.target_amount - d.saved_so_far, 0));
  const minPayments = order.map((d) => Math.max(d.debt_min_payment, 0));
  const monthlyRates = order.map((d) => d.debt_apr / 10000 / 12);

  let months = 0;
  let totalInterest = 0;
  let extra = extraPayment;
  const maxMonths = 1200;

  while (balances.some((b) => b > 0) && months < maxMonths) {
    months++;
    let rolled = extra;
    for (let i = 0; i < balances.length; i++) {
      if (balances[i]! <= 0) continue;
      const interest = Math.round(balances[i]! * monthlyRates[i]!);
      totalInterest += interest;
      balances[i] = balances[i]! + interest;
      const payment = Math.min(balances[i]!, minPayments[i]! + rolled);
      balances[i] = balances[i]! - payment;
      rolled = Math.max(rolled - Math.max(payment - minPayments[i]!, 0), 0);
      if (balances[i] === 0) {
        // Freed minimum payment rolls into the extra pool for following months.
        extra += minPayments[i]!;
        minPayments[i] = 0;
      }
    }
  }

  return { order, monthsToFreedom: months, totalInterest };
}
