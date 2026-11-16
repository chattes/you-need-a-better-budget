import type { Account, AccountSnapshot, NetWorthSnapshot } from './types';

const ASSET_TYPES = new Set(['cash', 'chequing', 'savings', 'asset']);
const LIABILITY_TYPES = new Set(['credit_card', 'liability']);

/** Daily net worth snapshot across all open accounts. */
export function snapshot(accounts: Account[], date: string): NetWorthSnapshot {
  const open = accounts.filter((a) => !a.is_closed && !a.deleted_at);
  const byAccount: AccountSnapshot[] = open.map((a) => ({
    account_id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance
  }));
  let assets = 0;
  let liabilities = 0;
  for (const a of open) {
    if (ASSET_TYPES.has(a.type)) assets += a.balance;
    else if (LIABILITY_TYPES.has(a.type)) liabilities += Math.abs(Math.min(a.balance, 0));
  }
  return { date, assets, liabilities, net_worth: assets - liabilities, by_account: byAccount };
}

export interface TrendPoint {
  date: string;
  net_worth: number;
}

/** Filter snapshots to a trailing period ending at the latest snapshot. */
export function trend(
  snapshots: NetWorthSnapshot[],
  period: '1M' | '3M' | '6M' | '1Y'
): TrendPoint[] {
  if (snapshots.length === 0) return [];
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const latest = new Date(sorted[sorted.length - 1]!.date + 'T00:00:00Z');
  const months = period === '1M' ? 1 : period === '3M' ? 3 : period === '6M' ? 6 : 12;
  const cutoff = new Date(latest);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return sorted
    .filter((s) => s.date >= cutoffIso)
    .map((s) => ({ date: s.date, net_worth: s.net_worth }));
}
