import type { RepeatRule, Transaction } from './types';

function parseDay(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  const day = out.getUTCDate();
  out.setUTCMonth(out.getUTCMonth() + n);
  // Clamp to month end (e.g. Jan 31 + 1 month → Feb 28/29)
  if (out.getUTCDate() < day) out.setUTCDate(0);
  return out;
}

/** Cadence-aware next occurrence strictly after `after`, or null when past end_date. */
export function getNextOccurrence(s: RepeatRule, after: Date): Date | null {
  let next = parseDay(s.next_date);
  // Advance until strictly after `after`
  const step = (d: Date): Date => {
    switch (s.cadence) {
      case 'weekly':
        return addDays(d, 7);
      case 'biweekly':
        return addDays(d, 14);
      case 'monthly':
        return addMonths(d, 1);
      case 'quarterly':
        return addMonths(d, 3);
      case 'yearly':
        return addMonths(d, 12);
      case 'custom':
        return addMonths(d, 1);
    }
  };
  let guard = 0;
  while (next <= after && guard < 1000) {
    next = step(next);
    guard++;
  }
  if (s.end_date && next > parseDay(s.end_date)) return null;
  return next;
}

/** Expand scheduled transactions into concrete instances within [from, to]. */
export function expandScheduled(
  scheduled: RepeatRule[],
  from: Date,
  to: Date
): Array<Pick<Transaction, 'date' | 'amount' | 'payee_id' | 'category_id' | 'account_id'> & { scheduled_id: string }> {
  const out: Array<
    Pick<Transaction, 'date' | 'amount' | 'payee_id' | 'category_id' | 'account_id'> & {
      scheduled_id: string;
    }
  > = [];
  for (const s of scheduled) {
    if (!s.is_active) continue;
    let cursor = parseDay(s.next_date);
    // Back up one step so occurrences before next_date are still covered
    // when next_date itself is beyond `from`.
    let guard = 0;
    while (cursor <= to && guard < 1000) {
      if (s.end_date && cursor > parseDay(s.end_date)) break;
      if (cursor >= from) {
        out.push({
          scheduled_id: s.id,
          date: toIso(cursor),
          amount: s.amount,
          payee_id: s.payee_id,
          category_id: s.category_id,
          account_id: s.account_id
        });
      }
      const next = getNextOccurrence({ ...s, next_date: toIso(cursor) }, cursor);
      if (!next) break;
      cursor = next;
      guard++;
    }
  }
  return out;
}

export interface RecurringSuggestion {
  key: string; // description|amount, lower-cased description
  description: string;
  amount: number; // cents, signed as recorded
  category_id: string | null;
  account_id: string;
  months: number; // length of the contiguous monthly run
  lastDate: string; // YYYY-MM-DD of the most recent occurrence
}

/**
 * Recurring payment detection from history (docs/study.md §8 MUST). A payment
 * is a suggestion when the same description and amount appear in at least two
 * contiguous calendar months. Transfers, splits and deleted rows are ignored.
 */
export function detectRecurring(transactions: Transaction[]): RecurringSuggestion[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.deleted_at || t.split_parent_id || t.is_split || t.type === 'transfer') continue;
    if (!t.description.trim()) continue;
    const key = `${t.description.trim().toLowerCase()}|${t.amount}`;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  const out: RecurringSuggestion[] = [];
  for (const [key, rows] of groups) {
    const months = [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort();
    if (months.length < 2) continue;
    // Longest run of consecutive months.
    let best = 1;
    let run = 1;
    for (let i = 1; i < months.length; i++) {
      run = monthIndex(months[i]!) - monthIndex(months[i - 1]!) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
    }
    if (best < 2) continue;
    const latest = rows.reduce((a, b) => (a.date >= b.date ? a : b));
    out.push({
      key,
      description: latest.description.trim(),
      amount: latest.amount,
      category_id: latest.category_id,
      account_id: latest.account_id,
      months: best,
      lastDate: latest.date
    });
  }
  return out.sort((a, b) => b.months - a.months || a.description.localeCompare(b.description));
}

function monthIndex(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return y! * 12 + (m! - 1);
}
