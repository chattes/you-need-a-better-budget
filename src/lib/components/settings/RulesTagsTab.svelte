<script lang="ts">
  import { labelsStore } from '$lib/stores/rules.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import Card from '../ui/Card.svelte';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';

  let pattern = $state('');
  let categoryId = $state('');
  let tagName = $state('');
  let error = $state('');

  async function addRule() {
    error = '';
    if (!pattern.trim() || !categoryId) {
      error = 'Enter text to match and pick a category.';
      return;
    }
    await labelsStore.addRule(pattern, categoryId);
    pattern = '';
  }

  async function addTag() {
    if (!tagName.trim()) return;
    await labelsStore.addTag(tagName);
    tagName = '';
  }
</script>

<Card>
  <h2>Categorization rules</h2>
  <p class="muted">Rules sort new transactions for you. A rule matches when the payee text contains its text.</p>
  {#if labelsStore.rules.length === 0}
    <p class="muted">No rules yet.</p>
  {:else}
    <ul>
      {#each labelsStore.rules as r (r.id)}
        <li>
          <span>{r.merchant_pattern}</span>
          <span class="chip">{categoriesStore.categories.find((c) => c.id === r.category_id)?.name ?? 'Missing category'}</span>
          <span class="muted">{r.source} • {r.match_count} matches</span>
          <button class="link" onclick={() => void labelsStore.removeRule(r.id)}>Delete</button>
        </li>
      {/each}
    </ul>
  {/if}
  <form class="row" onsubmit={(e) => { e.preventDefault(); void addRule(); }}>
    <Field label="Payee text"><input bind:value={pattern} /></Field>
    <Field label="Category">
      <select bind:value={categoryId}>
        <option value="">Choose…</option>
        {#each categoriesStore.categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
      </select>
    </Field>
    <Button type="submit">Add Rule</Button>
  </form>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</Card>

<Card>
  <h2>Tags</h2>
  {#if labelsStore.tags.length === 0}
    <p class="muted">No tags yet.</p>
  {:else}
    <ul>
      {#each labelsStore.tags as t (t.id)}
        <li>
          <span>{t.name}</span>
          <button class="link" onclick={() => { const n = prompt('Rename tag', t.name); if (n) void labelsStore.renameTag(t.id, n); }}>Rename</button>
          <button class="link" onclick={() => void labelsStore.removeTag(t.id)}>Delete</button>
        </li>
      {/each}
    </ul>
  {/if}
  <form class="row" onsubmit={(e) => { e.preventDefault(); void addTag(); }}>
    <Field label="New tag"><input bind:value={tagName} /></Field>
    <Button type="submit">Add Tag</Button>
  </form>
</Card>

<style>
  h2 {
    font-size: var(--font-size-base);
    margin: 0 0 var(--space-2);
  }
  ul {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
  }
  li {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-sm);
    align-items: center;
  }
  .row {
    display: flex;
    gap: var(--space-2);
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .chip {
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 1px var(--space-2);
    font-size: 0.75rem;
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .link {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    padding: 0;
    font: inherit;
    font-size: var(--font-size-sm);
  }
  .error {
    color: var(--color-negative);
  }
</style>
