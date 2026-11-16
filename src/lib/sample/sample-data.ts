/**
 * Test mode: a realistic demo budget written straight into IndexedDB.
 *
 * - Every sample row id starts with `demo-`, so Clear removes only sample rows.
 * - Rows are written with db.put, NOT the repository, so no outbox entries are
 *   created. Sample data never reaches a Google Sheet (sync and connect are blocked
 *   while the flag is on).
 * - No secrets, no passwords: this is local demo data only.
 */
import { getDb, getSetting } from '$lib/storage/indexeddb';
import type {
  Account,
  Category,
  CategoryGroup,
  CategorizationRule,
  Goal,
  IncomePlan,
  NetWorthSnapshot,
  RepeatRule,
  Subscription,
  Tag,
  Transaction
} from '$lib/domain/types';

export const SAMPLE_FLAG = 'sample_data_active';
const PREFIX = 'demo-';
const DEVICE = 'demo';

export interface SampleData {
  accounts: Account[];
  groups: CategoryGroup[];
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  scheduled: RepeatRule[];
  subscriptions: Subscription[];
  rules: CategorizationRule[];
  tags: Tag[];
  income_plan: IncomePlan[];
}

const STAMP = '2026-01-01T00:00:00.000Z';
const base = () => ({ created_at: STAMP, updated_at: STAMP, device_id: DEVICE, deleted_at: null });

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthShift(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Builds the sample dataset relative to `today` (YYYY-MM-DD). Pure: no IO. */
export function buildSampleData(today: string): SampleData {
  const M = today.slice(0, 7);
  const day = (offset: number, d: number) => `${monthShift(M, offset)}-${String(d).padStart(2, '0')}`;

  // ---- Accounts (manual; balances computed from the rows below) ----
  const openingBalance: Record<string, number> = {
    'demo-acc-chequing': 300000,
    'demo-acc-savings': 500000,
    'demo-acc-visa': -25000
  };
  const accounts: Account[] = [
    { id: 'demo-acc-chequing', name: 'Everyday Chequing', type: 'chequing', balance: 0, currency: 'CAD', is_budget_account: true, is_closed: false, sort_order: 0 },
    { id: 'demo-acc-savings', name: 'High-Interest Savings', type: 'savings', balance: 0, currency: 'CAD', is_budget_account: true, is_closed: false, sort_order: 1 },
    { id: 'demo-acc-visa', name: 'Rewards Visa', type: 'credit_card', balance: 0, currency: 'CAD', is_budget_account: false, is_closed: false, sort_order: 2 },
    { id: 'demo-nw-invest', name: 'Investment account', type: 'asset', balance: 800000, currency: 'CAD', is_budget_account: false, is_closed: false, sort_order: 3, asset_kind: 'investment' },
    { id: 'demo-nw-vehicle', name: 'Vehicle', type: 'asset', balance: 1200000, currency: 'CAD', is_budget_account: false, is_closed: false, sort_order: 4, asset_kind: 'property' },
    { id: 'demo-nw-carloan', name: 'Car loan', type: 'liability', balance: -900000, currency: 'CAD', is_budget_account: false, is_closed: false, sort_order: 5, liability_kind: 'car_loan', apr_bps: 699, min_payment: 25000 }
  ].map((a) => ({ ...base(), ...a }) as Account);

  // ---- Groups and categories (3 groups, 10 categories, mix of rolls-over and starts-fresh) ----
  const groups: CategoryGroup[] = [
    { id: 'demo-grp-housing', name: 'Housing', icon: 'home', color: '#1976d2', sort_order: 0, is_collapsed: false, budget: null },
    { id: 'demo-grp-food', name: 'Food & Dining', icon: 'utensils', color: '#388e3c', sort_order: 1, is_collapsed: false, budget: null },
    { id: 'demo-grp-life', name: 'Lifestyle', icon: 'shopping-bag', color: '#7b1fa2', sort_order: 2, is_collapsed: false, budget: null }
  ].map((g) => ({ ...base(), ...g }) as CategoryGroup);

  const cat = (
    id: string,
    group_id: string,
    name: string,
    monthly: number,
    rollover: Category['rollover_mode'],
    sort: number,
    extra: Partial<Category> = {}
  ): Category => ({
    ...base(),
    id: `demo-cat-${id}`,
    group_id,
    name,
    icon: 'circle',
    color: '#64748b',
    monthly_target: monthly,
    target_percent: null,
    cadence: 'monthly',
    due_day: null,
    rollover_mode: rollover,
    duration: 'ongoing',
    duration_month: null,
    note: '',
    goal_id: null,
    is_archived: false,
    sort_order: sort,
    ...extra
  });

  const categories: Category[] = [
    cat('rent', 'demo-grp-housing', 'Rent', 180000, 'starts_fresh', 0, { due_day: 1 }),
    cat('internet', 'demo-grp-housing', 'Internet & Phone', 11000, 'starts_fresh', 1, { due_day: 3 }),
    cat('groceries', 'demo-grp-food', 'Groceries', 50000, 'starts_fresh', 0),
    cat('dining', 'demo-grp-food', 'Dining out', 15000, 'starts_fresh', 1),
    cat('coffee', 'demo-grp-food', 'Coffee', 6000, 'rolls_over', 2),
    cat('transit', 'demo-grp-life', 'Transit', 12000, 'starts_fresh', 0),
    cat('car', 'demo-grp-life', 'Car Payment', 26000, 'starts_fresh', 1, { due_day: 8 }),
    cat('fun', 'demo-grp-life', 'Fun & Hobbies', 10000, 'rolls_over', 2),
    cat('gifts', 'demo-grp-life', 'Gifts', 8000, 'rolls_over', 3),
    cat('emergency', 'demo-grp-life', 'Emergency Fund', 15000, 'rolls_over', 4, { note: 'Rolls over until we need it.' })
  ].map((c) => ({ ...base(), ...c }) as Category);

  // ---- Transactions: three months (M-2, M-1, M) ----
  const transactions: Transaction[] = [];
  const row = (
    id: string,
    date: string,
    amount: number,
    account_id: string,
    type: Transaction['type'],
    description: string,
    category_id: string | null,
    extra: Partial<Transaction> = {}
  ) => {
    transactions.push({
      ...base(),
      id: `demo-tx-${id}`,
      date,
      amount,
      payee_id: '',
      category_id,
      account_id,
      goal_id: null,
      type,
      description,
      notes: '',
      tags: [],
      is_split: false,
      split_parent_id: null,
      transfer_pair_id: null,
      excluded_from_budget: false,
      repeat_rule_id: null,
      import_id: '',
      ...extra
    } as Transaction);
  };
  const chq = 'demo-acc-chequing';
  const visa = 'demo-acc-visa';
  const sav = 'demo-acc-savings';

  for (const offset of [-2, -1, 0]) {
    const k = `m${offset + 2}`; // m0, m1, m2
    row(`${k}-pay1`, day(offset, 1), 225000, chq, 'income', 'Employer payroll', null);
    row(`${k}-pay2`, day(offset, 15), 225000, chq, 'income', 'Employer payroll', null);
    row(`${k}-rent`, day(offset, 1), -180000, chq, 'expense', 'Landlord', 'demo-cat-rent');
    row(`${k}-net`, day(offset, 3), -11000, chq, 'expense', 'Internet & Phone', 'demo-cat-internet');
    row(`${k}-bus`, day(offset, 2), -12000, chq, 'expense', 'Transit pass', 'demo-cat-transit');
    row(`${k}-groc1`, day(offset, 4), -12850, chq, 'expense', 'Grocery store', 'demo-cat-groceries');
    row(`${k}-groc2`, day(offset, 11), -9640, chq, 'expense', 'Grocery store', 'demo-cat-groceries');
    row(`${k}-cafe1`, day(offset, 5), -550, chq, 'expense', 'Cafe downtown', 'demo-cat-coffee');
    row(`${k}-cafe2`, day(offset, 9), -525, chq, 'expense', 'Cafe downtown', 'demo-cat-coffee');
    row(`${k}-car`, day(offset, 8), -26000, chq, 'expense', 'Car payment', 'demo-cat-car');
    row(`${k}-movie`, day(offset, 6), -4000, chq, 'expense', 'Movie tickets', 'demo-cat-fun');
    row(`${k}-xfer-a`, day(offset, 2), -20000, chq, 'transfer', 'Savings transfer', null, { transfer_pair_id: `demo-tx-${k}-xfer-b` });
    row(`${k}-xfer-b`, day(offset, 2), 20000, sav, 'transfer', 'Savings transfer', null, { transfer_pair_id: `demo-tx-${k}-xfer-a` });
  }
  // Last month: a gift on the card, and a card payment that clears most of it.
  row('m1-gift', day(-1, 10), -4500, visa, 'expense', 'Birthday gift', 'demo-cat-gifts');
  row('m1-cardpay-a', day(-1, 20), -15000, chq, 'transfer', 'Card payment', null, { transfer_pair_id: 'demo-tx-m1-cardpay-b' });
  row('m1-cardpay-b', day(-1, 20), 15000, visa, 'transfer', 'Card payment', null, { transfer_pair_id: 'demo-tx-m1-cardpay-a' });

  // This month: split grocery run, card purchase (over budget), card payment.
  const costco = 'demo-tx-m2-costco';
  row('m2-costco', day(0, 7), -21000, chq, 'expense', 'Costco run', null, { is_split: true });
  transactions.push({ ...base(), id: `${costco}-1`, date: day(0, 7), amount: -15000, payee_id: '', category_id: 'demo-cat-groceries', account_id: chq, goal_id: null, type: 'expense', description: 'Costco run', notes: '', tags: [], is_split: true, split_parent_id: costco, transfer_pair_id: null, excluded_from_budget: false, repeat_rule_id: null, import_id: '' } as Transaction);
  transactions.push({ ...base(), id: `${costco}-2`, date: day(0, 7), amount: -6000, payee_id: '', category_id: 'demo-cat-gifts', account_id: chq, goal_id: null, type: 'expense', description: 'Costco run', notes: '', tags: [], is_split: true, split_parent_id: costco, transfer_pair_id: null, excluded_from_budget: false, repeat_rule_id: null, import_id: '' } as Transaction);
  row('m2-dinner', day(0, 12), -19000, visa, 'expense', 'Restaurant dinner', 'demo-cat-dining', { tags: ['Holiday'] });
  row('m2-cardpay-a', day(0, 13), -30000, chq, 'transfer', 'Card payment', null, { transfer_pair_id: 'demo-tx-m2-cardpay-b' });
  row('m2-cardpay-b', day(0, 13), 30000, visa, 'transfer', 'Card payment', null, { transfer_pair_id: 'demo-tx-m2-cardpay-a' });

  // Balances: opening + every row that has a balance effect (split children do not).
  for (const a of accounts) {
    if (!(a.id in openingBalance)) continue;
    const sum = transactions
      .filter((t) => t.account_id === a.id && !t.split_parent_id)
      .reduce((s, t) => s + t.amount, 0);
    a.balance = openingBalance[a.id]! + sum;
  }

  // ---- Income plan, goals, recurring, subscriptions, rules, tags ----
  const income_plan: IncomePlan[] = [
    { ...base(), id: 'demo-income-plan', month: monthShift(M, -2), mode: 'fixed', pay_amount: 225000, frequency: 'twice_monthly', pay_day: 15, note: 'Sample income' } as IncomePlan
  ];
  const goals: Goal[] = [
    { ...base(), id: 'demo-goal-emergency', name: 'Emergency fund', type: 'savings', target_amount: 500000, target_date: null, saved_so_far: 120000, monthly_contribution: 30000, description: 'Six months of expenses', linked_account_id: null, linked_category_id: null, debt_apr: 0, debt_min_payment: 0, payoff_strategy: 'avalanche' } as Goal,
    { ...base(), id: 'demo-goal-japan', name: 'Japan trip', type: 'savings', target_amount: 300000, target_date: addDays(today, 365), saved_so_far: 45000, monthly_contribution: 15000, description: '', linked_account_id: null, linked_category_id: null, debt_apr: 0, debt_min_payment: 0, payoff_strategy: 'avalanche' } as Goal
  ];
  const nextInternet = `${monthShift(M, 1)}-03`;
  const scheduled: RepeatRule[] = [
    { ...base(), id: 'demo-rr-internet', name: 'Internet & Phone', amount: -11000, payee_id: '', category_id: 'demo-cat-internet', account_id: chq, cadence: 'monthly', next_date: nextInternet, end_date: null, is_active: true } as RepeatRule
  ];
  const subscriptions: Subscription[] = [
    { ...base(), id: 'demo-sub-stream', merchant_name: 'Streaming Plus', amount: 1699, cadence: 'monthly', next_charge_date: addDays(today, 3), category_id: null, account_id: null, is_detected: false } as Subscription,
    { ...base(), id: 'demo-sub-cloud', merchant_name: 'Cloud Storage', amount: 9900, cadence: 'yearly', next_charge_date: addDays(today, 60), category_id: null, account_id: null, is_detected: false } as Subscription
  ];
  const rules: CategorizationRule[] = [
    { ...base(), id: 'demo-rule-cafe', merchant_pattern: 'cafe', category_id: 'demo-cat-coffee', source: 'user', match_count: 2, last_matched_at: null } as CategorizationRule
  ];
  const tags: Tag[] = [
    { ...base(), id: 'demo-tag-work', name: 'Work', color: '#1976d2' } as Tag,
    { ...base(), id: 'demo-tag-holiday', name: 'Holiday', color: '#388e3c' } as Tag
  ];

  return { accounts, groups, categories, transactions, goals, scheduled, subscriptions, rules, tags, income_plan };
}

/** True while sample data is loaded. Sync and Google connect check this. */
export async function isSampleActive(): Promise<boolean> {
  return (await getSetting(SAMPLE_FLAG)) === 'true';
}

/** Writes the sample dataset (replaces any earlier sample rows). Never touches real rows. */
export async function loadSampleData(today: string): Promise<void> {
  await clearSampleRows();
  const data = buildSampleData(today);
  const db = await getDb();
  const tx = db.transaction(
    ['accounts', 'groups', 'categories', 'transactions', 'goals', 'scheduled', 'subscriptions', 'rules', 'tags', 'income_plan', 'settings'],
    'readwrite'
  );
  for (const a of data.accounts) await tx.objectStore('accounts').put(a);
  for (const g of data.groups) await tx.objectStore('groups').put(g);
  for (const c of data.categories) await tx.objectStore('categories').put(c);
  for (const t of data.transactions) await tx.objectStore('transactions').put(t);
  for (const g of data.goals) await tx.objectStore('goals').put(g);
  for (const s of data.scheduled) await tx.objectStore('scheduled').put(s);
  for (const s of data.subscriptions) await tx.objectStore('subscriptions').put(s);
  for (const r of data.rules) await tx.objectStore('rules').put(r);
  for (const t of data.tags) await tx.objectStore('tags').put(t);
  for (const p of data.income_plan) await tx.objectStore('income_plan').put(p);
  await tx.objectStore('settings').put({ key: SAMPLE_FLAG, value: 'true', updated_at: new Date().toISOString() });
  await tx.objectStore('settings').put({ key: 'onboarding_dismissed', value: 'true', updated_at: new Date().toISOString() });
  await tx.done;
}

/** Removes every row whose id starts with `demo-` (no outbox entries), then clears the flag. */
export async function clearSampleRows(): Promise<void> {
  const db = await getDb();
  const stores = ['accounts', 'groups', 'categories', 'transactions', 'month_budgets', 'income_plan', 'goals', 'subscriptions', 'scheduled', 'rules', 'tags', 'payees'] as const;
  const tx = db.transaction([...stores, 'snapshots', 'settings'], 'readwrite');
  for (const name of stores) {
    const store = tx.objectStore(name);
    const keys = await store.getAllKeys();
    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith(PREFIX)) await store.delete(key);
    }
  }
  // Net worth snapshots taken while sample data was loaded.
  const snaps = tx.objectStore('snapshots');
  for (const s of (await snaps.getAll()) as NetWorthSnapshot[]) {
    if (s.by_account.some((a) => a.account_id.startsWith(PREFIX))) await snaps.delete(s.date);
  }
  await tx.objectStore('settings').delete(SAMPLE_FLAG);
  await tx.done;
}

export async function clearSampleData(): Promise<void> {
  await clearSampleRows();
}

