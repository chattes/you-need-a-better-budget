import type { CategorizationRule, Tag } from '$lib/domain/types';
import { IdbRepository, makeEntityId } from '$lib/storage/indexeddb';
import { getDeviceId, nowIso } from '$lib/utils/date';

const ruleRepo = new IdbRepository<CategorizationRule>('rules');
const tagRepo = new IdbRepository<Tag>('tags');

/** Rules and tags (spec §3.9). Rules match a payee text and set a category. */
function createLabelsStore() {
  let rules = $state<CategorizationRule[]>([]);
  let tags = $state<Tag[]>([]);

  async function load() {
    rules = (await ruleRepo.getAll()).sort((a, b) => a.merchant_pattern.localeCompare(b.merchant_pattern));
    tags = (await tagRepo.getAll()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function addRule(merchant_pattern: string, category_id: string, source: CategorizationRule['source'] = 'user') {
    const now = nowIso();
    const row: CategorizationRule = {
      id: makeEntityId(),
      merchant_pattern: merchant_pattern.trim(),
      category_id,
      source,
      match_count: 0,
      last_matched_at: null,
      created_at: now,
      updated_at: now,
      device_id: getDeviceId(),
      deleted_at: null
    };
    await ruleRepo.upsert(row);
    rules = [...rules, row];
  }

  async function removeRule(id: string) {
    await ruleRepo.delete(id);
    rules = rules.filter((r) => r.id !== id);
  }

  async function addTag(name: string, color = '#64748b') {
    const now = nowIso();
    const row: Tag = {
      id: makeEntityId(),
      name: name.trim(),
      color,
      created_at: now,
      updated_at: now,
      device_id: getDeviceId(),
      deleted_at: null
    };
    await tagRepo.upsert(row);
    tags = [...tags, row];
  }

  async function renameTag(id: string, name: string) {
    const existing = tags.find((t) => t.id === id);
    if (!existing) return;
    const next = { ...existing, name: name.trim(), updated_at: nowIso(), device_id: getDeviceId() };
    await tagRepo.upsert(next);
    tags = tags.map((t) => (t.id === id ? next : t));
  }

  async function removeTag(id: string) {
    await tagRepo.delete(id);
    tags = tags.filter((t) => t.id !== id);
  }

  /** The category a rule gives for a description, or null. Longest pattern wins. */
  function matchRule(description: string): CategorizationRule | null {
    const text = description.trim().toLowerCase();
    if (!text) return null;
    let best: CategorizationRule | null = null;
    for (const r of rules) {
      const pattern = r.merchant_pattern.toLowerCase();
      if (pattern && text.includes(pattern) && (!best || pattern.length > best.merchant_pattern.length)) {
        best = r;
      }
    }
    return best;
  }

  return {
    get rules() {
      return rules;
    },
    get tags() {
      return tags;
    },
    load,
    addRule,
    removeRule,
    addTag,
    renameTag,
    removeTag,
    matchRule
  };
}

export const labelsStore = createLabelsStore();
