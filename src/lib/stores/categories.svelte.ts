import type { Category, CategoryGroup } from '$lib/domain/types';
import { IdbRepository, makeEntityId } from '$lib/storage/indexeddb';
import { getDeviceId, nowIso } from '$lib/utils/date';

const categoryRepo = new IdbRepository<Category>('categories');
const groupRepo = new IdbRepository<CategoryGroup>('groups');

export type NewCategoryInput = {
  group_id: string | null;
  name: string;
  icon?: string;
  color?: string;
  /** Null = "Not budgeted". */
  monthly_target?: number | null;
  target_percent?: number | null;
  cadence?: Category['cadence'];
  due_day?: number | null;
  rollover_mode?: Category['rollover_mode'];
  duration?: Category['duration'];
  duration_month?: string | null;
  note?: string;
};

function createCategoriesStore() {
  let categories = $state<Category[]>([]);
  let groups = $state<CategoryGroup[]>([]);

  async function load() {
    const [cats, grps] = await Promise.all([categoryRepo.getAll(), groupRepo.getAll()]);
    categories = cats.sort((a, b) => a.sort_order - b.sort_order);
    groups = grps.sort((a, b) => a.sort_order - b.sort_order);
  }

  async function addGroup(name: string): Promise<CategoryGroup> {
    const now = nowIso();
    const group: CategoryGroup = {
      id: makeEntityId(),
      name: name.trim(),
      icon: 'folder',
      color: '#64748b',
      sort_order: groups.length,
      is_collapsed: false,
      budget: null,
      created_at: now,
      updated_at: now,
      device_id: getDeviceId(),
      deleted_at: null
    };
    await groupRepo.upsert(group);
    groups = [...groups, group];
    return group;
  }

  async function updateGroup(id: string, patch: Partial<CategoryGroup>): Promise<void> {
    const existing = groups.find((g) => g.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch, id, updated_at: nowIso(), device_id: getDeviceId() };
    await groupRepo.upsert(next);
    groups = groups.map((g) => (g.id === id ? next : g));
  }

  /** Delete a group; its categories become ungrouped (budgets and
   * transactions are kept). */
  async function removeGroup(id: string): Promise<void> {
    await groupRepo.delete(id);
    groups = groups.filter((g) => g.id !== id);
    const orphans = categories.filter((c) => c.group_id === id);
    for (const c of orphans) await update(c.id, { group_id: null });
  }

  async function add(input: NewCategoryInput): Promise<Category> {
    const now = nowIso();
    const category: Category = {
      id: makeEntityId(),
      group_id: input.group_id,
      name: input.name.trim(),
      icon: input.icon ?? 'circle',
      color: input.color ?? '#64748b',
      monthly_target: input.monthly_target ?? null,
      target_percent: input.target_percent ?? null,
      cadence: input.cadence ?? 'monthly',
      due_day: input.due_day ?? null,
      rollover_mode: input.rollover_mode ?? 'starts_fresh',
      duration: input.duration ?? 'ongoing',
      duration_month: input.duration_month ?? null,
      note: input.note ?? '',
      goal_id: null,
      is_archived: false,
      sort_order: categories.filter((c) => c.group_id === input.group_id).length,
      created_at: now,
      updated_at: now,
      device_id: getDeviceId(),
      deleted_at: null
    };
    await categoryRepo.upsert(category);
    categories = [...categories, category];
    return category;
  }

  async function update(id: string, patch: Partial<Category>): Promise<void> {
    const existing = categories.find((c) => c.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch, id, updated_at: nowIso(), device_id: getDeviceId() };
    await categoryRepo.upsert(next);
    categories = categories.map((c) => (c.id === id ? next : c));
  }

  async function archive(id: string, archived = true): Promise<void> {
    await update(id, { is_archived: archived });
  }

  async function remove(id: string): Promise<void> {
    await categoryRepo.delete(id);
    categories = categories.filter((c) => c.id !== id);
  }

  async function reorder(kind: 'category' | 'group', orderedIds: string[]): Promise<void> {
    if (kind === 'category') {
      const now = nowIso();
      categories = categories.map((c) => {
        const idx = orderedIds.indexOf(c.id);
        return idx >= 0
          ? { ...c, sort_order: idx, updated_at: now, device_id: getDeviceId() }
          : c;
      });
      await categoryRepo.upsertMany(categories.filter((c) => orderedIds.includes(c.id)));
    } else {
      const now = nowIso();
      groups = groups.map((g) => {
        const idx = orderedIds.indexOf(g.id);
        return idx >= 0
          ? { ...g, sort_order: idx, updated_at: now, device_id: getDeviceId() }
          : g;
      });
      await groupRepo.upsertMany(groups.filter((g) => orderedIds.includes(g.id)));
    }
  }

  return {
    get categories() {
      return categories;
    },
    get groups() {
      return groups;
    },
    get activeCategories() {
      return categories.filter((c) => !c.is_archived);
    },
    load,
    add,
    update,
    archive,
    remove,
    reorder,
    addGroup,
    updateGroup,
    removeGroup
  };
}

export const categoriesStore = createCategoriesStore();
