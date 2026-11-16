// Core entity types (spec v2, docs/study.md §5). All IDs are UUID strings.
// Money = integer cents. updated_at = ISO timestamp; device_id identifies the
// writer for sync; deleted_at = soft delete.

export type AccountType =
  | 'cash'
  | 'chequing'
  | 'savings'
  | 'credit_card'
  | 'asset'
  | 'liability';

export type AssetKind = 'cash' | 'investment' | 'property' | 'other';

export type LiabilityKind =
  | 'mortgage'
  | 'car_loan'
  | 'student_loan'
  | 'personal_loan'
  | 'credit_card'
  | 'other';

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  device_id: string;
  deleted_at?: string | null;
}

export interface Account extends BaseEntity {
  name: string;
  type: AccountType;
  balance: number;
  currency: string; // ISO 4217, default CAD
  is_budget_account: boolean;
  is_closed: boolean;
  is_hidden?: boolean;
  sort_order: number;
  /** Net worth grouping for asset/liability accounts. */
  asset_kind?: AssetKind;
  liability_kind?: LiabilityKind;
  apr_bps?: number;
  min_payment?: number;
}

export interface CategoryGroup extends BaseEntity {
  name: string;
  icon: string; // Lucide name
  color: string; // hex
  sort_order: number;
  is_collapsed: boolean;
  /** Optional group-level budget (set via "Set a Group Budget"). Null = use
   * the sum of the group's category budgets (spec formula 8). */
  budget: number | null;
}

export type CategoryCadence =
  | 'monthly'
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'bimonthly'
  | 'quarterly'
  | 'yearly';

export type RolloverMode = 'rolls_over' | 'starts_fresh';
export type CategoryDuration = 'ongoing' | 'this_month_only';

export interface Category extends BaseEntity {
  group_id: string | null; // null = ungrouped
  name: string;
  icon: string;
  color: string;
  /** Monthly budget target in cents. Null = "Not budgeted". */
  monthly_target: number | null;
  /** Alternative to monthly_target: % of planned income (0–100). */
  target_percent: number | null;
  cadence: CategoryCadence;
  due_day: number | null;
  rollover_mode: RolloverMode;
  duration: CategoryDuration;
  duration_month: string | null; // YYYY-MM, for this_month_only
  note: string;
  goal_id: string | null;
  is_archived: boolean;
  sort_order: number;
}

export type TransactionType = 'expense' | 'income' | 'reimbursement' | 'refund' | 'transfer';

export interface Transaction extends BaseEntity {
  date: string; // ISO date (YYYY-MM-DD)
  amount: number; // cents, signed: +income, −expense
  payee_id: string;
  category_id: string | null;
  account_id: string;
  goal_id: string | null;
  type: TransactionType;
  description: string;
  notes: string;
  tags: string[]; // tag ids
  is_split: boolean;
  split_parent_id: string | null;
  transfer_pair_id: string | null;
  excluded_from_budget: boolean;
  repeat_rule_id: string | null;
  import_id: string;
}

export interface SplitTransaction {
  id: string;
  parent_id: string;
  category_id: string;
  amount: number;
  memo: string;
}

/**
 * The user-set budget for a category in one month (spec: MonthBudgets tab).
 * Only `budgeted` is stored; spent/carried are derived from transactions.
 */
export interface MonthBudget extends BaseEntity {
  month: string; // YYYY-MM
  category_id: string;
  budgeted: number;
}

export type IncomeMode = 'fixed' | 'variable';
export type PayFrequency = 'once_monthly' | 'twice_monthly' | 'biweekly' | 'weekly';

export interface IncomePlan extends BaseEntity {
  month: string; // YYYY-MM the plan takes effect from
  mode: IncomeMode;
  pay_amount: number; // cents per pay (fixed mode)
  frequency: PayFrequency;
  pay_day: number; // 1–31; shorter months use the last day
  note: string;
}

export type PayoffStrategy = 'avalanche' | 'snowball';

export interface Goal extends BaseEntity {
  name: string;
  type: 'savings' | 'debt_payoff';
  target_amount: number;
  target_date: string | null;
  saved_so_far: number;
  monthly_contribution: number;
  description: string;
  linked_account_id: string | null;
  linked_category_id: string | null;
  debt_apr: number; // basis points
  debt_min_payment: number;
  payoff_strategy: PayoffStrategy;
}

export type RepeatCadence =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom';

export interface RepeatRule extends BaseEntity {
  name: string;
  amount: number;
  payee_id: string;
  category_id: string;
  account_id: string;
  cadence: RepeatCadence;
  next_date: string;
  end_date: string | null;
  is_active: boolean;
}

export type SubscriptionCadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription extends BaseEntity {
  merchant_name: string;
  amount: number;
  cadence: SubscriptionCadence;
  next_charge_date: string;
  category_id: string | null;
  account_id: string | null;
  is_detected: boolean;
}

export type RuleSource = 'user' | 'learned' | 'imported';

export interface CategorizationRule extends BaseEntity {
  merchant_pattern: string;
  category_id: string;
  source: RuleSource;
  match_count: number;
  last_matched_at: string | null;
}

export interface Tag extends BaseEntity {
  name: string;
  color: string;
}

export interface Payee extends BaseEntity {
  name: string;
  default_category_id: string | null;
  renaming_rule: string | null;
}

export interface NetWorthSnapshot {
  date: string;
  assets: number;
  liabilities: number;
  net_worth: number;
  by_account: AccountSnapshot[];
}

export interface AccountSnapshot {
  account_id: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface Period {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}
