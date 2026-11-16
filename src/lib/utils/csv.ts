import Papa from 'papaparse';
import type { Account, Category, CategoryGroup, Transaction, TransactionType } from '$lib/domain/types';
import { isSplitParent } from '$lib/domain/splits';

/**
 * CSV format (docs/study.md §7). Export and import use the same header row.
 * Required on import: Date, Amount, Description. The rest are optional.
 */
export const CSV_HEADER = [
  'Date',
  'Description',
  'Amount',
  'Category',
  'Group',
  'Type',
  'Tags',
  'Notes',
  'Excluded from Budget',
  'Account',
  'Account Last 4',
  'Bank',
  'Original Amount',
  'Original Currency',
  'FX Rate'
] as const;

const TYPES: TransactionType[] = ['expense', 'income', 'reimbursement', 'refund', 'transfer'];

export interface CsvContext {
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
}

/** Export transactions in the spec §7 column order. Split parents are skipped; children are exported. */
export function transactionsToCsv(transactions: Transaction[], ctx: CsvContext): string {
  const accountName = (id: string) => ctx.accounts.find((a) => a.id === id)?.name ?? '';
  const category = (id: string | null) => ctx.categories.find((c) => c.id === id);
  const groupName = (c: Category | undefined) => ctx.groups.find((g) => g.id === c?.group_id)?.name ?? '';
  const rows = transactions
    .filter((t) => !t.deleted_at && !isSplitParent(t))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const c = category(t.category_id);
      return {
        Date: t.date,
        Description: t.description,
        Amount: (t.amount / 100).toFixed(2),
        Category: c?.name ?? '',
        Group: groupName(c),
        Type: t.type,
        Tags: t.tags.join(';'),
        Notes: t.notes,
        'Excluded from Budget': t.excluded_from_budget ? 'TRUE' : 'FALSE',
        Account: accountName(t.account_id),
        'Account Last 4': '',
        Bank: '',
        'Original Amount': '',
        'Original Currency': '',
        'FX Rate': ''
      };
    });
  return Papa.unparse(rows, { columns: [...CSV_HEADER] });
}

/** Trigger a browser download of a text file. */
export function downloadTextFile(filename: string, text: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface CsvRow {
  date: string;
  description: string;
  amount: number; // cents, signed (expense negative)
  type: TransactionType;
  category: string;
  group: string;
  account: string;
  tags: string[];
  notes: string;
  excluded: boolean;
  import_id: string;
}

/** Stable id for duplicate detection: Date, Amount, Description, Account (spec §7). */
export function importId(date: string, amount: number, description: string, account: string): string {
  const text = `${date}|${amount}|${description.trim().toLowerCase()}|${account.trim().toLowerCase()}`;
  // FNV-1a 32-bit: small and deterministic; collisions are caught by the full key anyway.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toCents(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

/** Parse a spec §7 CSV. Unknown extra columns are ignored. Returns rows and per-row errors. */
export function parseCsv(text: string): { rows: CsvRow[]; errors: string[]; missingColumns: string[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim()
  });
  const headers = result.meta.fields ?? [];
  const find = (name: string) => headers.find((h) => h.toLowerCase() === name.toLowerCase());
  const missingColumns = ['Date', 'Amount', 'Description'].filter((n) => !find(n));
  const errors: string[] = result.errors.map((e) => e.message);
  if (missingColumns.length > 0) return { rows: [], errors, missingColumns };

  const rows: CsvRow[] = [];
  result.data.forEach((raw, idx) => {
    const get = (name: string) => {
      const key = find(name);
      return key ? (raw[key] ?? '').trim() : '';
    };
    const date = normalizeDate(get('Date'));
    const amount = toCents(get('Amount'));
    if (!date || amount === null) {
      errors.push(`Row ${idx + 2}: date or amount not readable. Skipped.`);
      return;
    }
    const description = get('Description');
    const account = get('Account');
    const typed = get('Type').toLowerCase() as TransactionType;
    const type: TransactionType = TYPES.includes(typed) ? typed : amount < 0 ? 'expense' : 'income';
    const excluded = get('Excluded from Budget').toUpperCase() === 'TRUE';
    rows.push({
      date,
      description,
      amount,
      type,
      category: get('Category'),
      group: get('Group'),
      account,
      tags: get('Tags')
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean),
      notes: get('Notes'),
      excluded,
      import_id: importId(date, amount, description, account)
    });
  });
  return { rows, errors, missingColumns };
}
