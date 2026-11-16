import type {
  Account,
  Category,
  CategoryGroup,
  IncomePlan,
  MonthBudget,
  Transaction
} from '$lib/domain/types';

export const NOW = '2026-11-01T12:00:00.000Z';
export const DEVICE = 'test-device';

let seq = 0;
export function makeId(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

export function account(overrides: Partial<Account>): Account {
  return {
    id: makeId(),
    name: 'Account',
    type: 'chequing',
    balance: 0,
    currency: 'CAD',
    is_budget_account: true,
    is_closed: false,
    is_hidden: false,
    sort_order: 0,
    created_at: NOW,
    updated_at: NOW,
    device_id: DEVICE,
    deleted_at: null,
    ...overrides
  };
}

export function group(overrides: Partial<CategoryGroup>): CategoryGroup {
  return {
    id: makeId(),
    name: 'Group',
    icon: 'folder',
    color: '#64748b',
    sort_order: 0,
    is_collapsed: false,
    budget: null,
    created_at: NOW,
    updated_at: NOW,
    device_id: DEVICE,
    deleted_at: null,
    ...overrides
  };
}

export function category(overrides: Partial<Category>): Category {
  return {
    id: makeId(),
    group_id: 'group-1',
    name: 'Category',
    icon: 'circle',
    color: '#64748b',
    monthly_target: 0,
    target_percent: null,
    cadence: 'monthly',
    due_day: null,
    rollover_mode: 'starts_fresh',
    duration: 'ongoing',
    duration_month: null,
    note: '',
    goal_id: null,
    is_archived: false,
    sort_order: 0,
    created_at: NOW,
    updated_at: NOW,
    device_id: DEVICE,
    deleted_at: null,
    ...overrides
  };
}

export function monthBudget(overrides: Partial<MonthBudget>): MonthBudget {
  return {
    id: makeId(),
    month: '2026-11',
    category_id: 'cat',
    budgeted: 0,
    created_at: NOW,
    updated_at: NOW,
    device_id: DEVICE,
    deleted_at: null,
    ...overrides
  };
}

export function incomePlan(overrides: Partial<IncomePlan>): IncomePlan {
  return {
    id: makeId(),
    month: '2026-11',
    mode: 'fixed',
    pay_amount: 225_000,
    frequency: 'twice_monthly',
    pay_day: 15,
    note: '',
    created_at: NOW,
    updated_at: NOW,
    device_id: DEVICE,
    deleted_at: null,
    ...overrides
  };
}

export function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: makeId(),
    date: '2026-11-05',
    amount: 0,
    payee_id: 'payee-1',
    category_id: null,
    account_id: 'acct-1',
    goal_id: null,
    type: 'expense',
    description: '',
    notes: '',
    tags: [],
    is_split: false,
    split_parent_id: null,
    transfer_pair_id: null,
    excluded_from_budget: false,
    repeat_rule_id: null,
    import_id: '',
    created_at: NOW,
    updated_at: NOW,
    device_id: DEVICE,
    deleted_at: null,
    ...overrides
  };
}
