<script lang="ts">
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { groupBudget } from '$lib/domain/budget';
  import { formatCents, parseToCents } from '$lib/domain/money';
  import type { CategoryGroup } from '$lib/domain/types';
  import Dialog from '../ui/Dialog.svelte';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  type Panel = 'edit' | 'budget' | 'delete' | null;
  let newName = $state('');
  let openGroup = $state<string | null>(null);
  let panel = $state<Panel>(null);
  let draftName = $state('');
  let draftBudget = $state('');

  function toggle(g: CategoryGroup, p: Exclude<Panel, null>) {
    if (openGroup === g.id && panel === p) {
      openGroup = null;
      panel = null;
      return;
    }
    openGroup = g.id;
    panel = p;
    draftName = g.name;
    draftBudget = g.budget != null ? String(g.budget / 100) : '';
  }

  async function addGroup() {
    if (!newName.trim()) return;
    await categoriesStore.addGroup(newName);
    newName = '';
  }

  async function saveName(g: CategoryGroup) {
    if (!draftName.trim()) return;
    await categoriesStore.updateGroup(g.id, { name: draftName.trim() });
    openGroup = null;
    panel = null;
  }

  async function saveBudget(g: CategoryGroup) {
    // Blank = no explicit group budget (the sum of its categories is used).
    const cents = draftBudget.trim() === '' ? null : parseToCents(draftBudget);
    await categoriesStore.updateGroup(g.id, { budget: cents });
    openGroup = null;
    panel = null;
  }

  async function removeGroup(g: CategoryGroup) {
    await categoriesStore.removeGroup(g.id);
    openGroup = null;
    panel = null;
  }

  function sumFor(g: CategoryGroup): number {
    return groupBudget(g, categoriesStore.categories, budgetStore.month, budgetStore.monthBudgets, budgetStore.planned);
  }
</script>

<Dialog {open} title="Organize categories" {onclose}>
  <div class="organize">
    <form
      class="new-group"
      onsubmit={(e) => {
        e.preventDefault();
        void addGroup();
      }}
    >
      <input bind:value={newName} placeholder="New group name" aria-label="New group name" />
      <Button type="submit">New Group</Button>
    </form>

    {#if categoriesStore.groups.length === 0}
      <p class="muted">No groups yet.</p>
    {/if}

    <ul class="groups">
      {#each categoriesStore.groups as g (g.id)}
        <li>
          <div class="group-row">
            <span class="name">{g.name}</span>
            <span class="amount">{formatCents(sumFor(g))}/mo</span>
            <span class="menu" role="group" aria-label="Options for {g.name}">
              <button onclick={() => toggle(g, 'edit')}>Edit Group</button>
              <button onclick={() => toggle(g, 'budget')}>Set a Group Budget</button>
              <button class="danger" onclick={() => toggle(g, 'delete')}>Delete Group</button>
            </span>
          </div>

          {#if openGroup === g.id && panel === 'edit'}
            <form class="panel" onsubmit={(e) => { e.preventDefault(); void saveName(g); }}>
              <Field label="Group Name"><input bind:value={draftName} required /></Field>
              <div class="actions"><Button variant="secondary" onclick={() => (openGroup = null)}>Cancel</Button><Button type="submit">Update Group</Button></div>
            </form>
          {:else if openGroup === g.id && panel === 'budget'}
            <form class="panel" onsubmit={(e) => { e.preventDefault(); void saveBudget(g); }}>
              <Field label="Amount (blank = sum of categories)"><input inputmode="decimal" bind:value={draftBudget} /></Field>
              <div class="actions"><Button variant="secondary" onclick={() => (openGroup = null)}>Cancel</Button><Button type="submit">Save Group Budget</Button></div>
            </form>
          {:else if openGroup === g.id && panel === 'delete'}
            <div class="panel">
              <p>Delete {g.name}?</p>
              <p class="muted">The categories inside become ungrouped. Their budgets and transactions are kept.</p>
              <div class="actions"><Button variant="secondary" onclick={() => (openGroup = null)}>Cancel</Button><Button variant="danger" onclick={() => void removeGroup(g)}>Delete Group</Button></div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
</Dialog>

<style>
  .organize {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: min(480px, 90vw);
  }
  .new-group {
    display: flex;
    gap: var(--space-2);
  }
  .new-group input {
    flex: 1;
  }
  .groups {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .group-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .name {
    font-weight: 600;
    flex: 1;
  }
  .amount {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .menu {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }
  .menu button {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 2px var(--space-2);
    color: var(--color-text);
    font-size: var(--font-size-sm);
    cursor: pointer;
  }
  .menu .danger {
    color: var(--color-negative);
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    margin-top: var(--space-2);
  }
  .panel p {
    margin: 0;
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
