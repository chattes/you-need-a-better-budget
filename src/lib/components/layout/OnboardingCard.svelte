<script lang="ts">
  import { onMount } from 'svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { getSetting, setSetting } from '$lib/storage/indexeddb';
  import { getSpreadsheetId } from '$lib/storage/sync';
  import Card from '../ui/Card.svelte';
  import Button from '../ui/Button.svelte';
  import { sampleStore } from '$lib/stores/sample.svelte';

  const DISMISS_KEY = 'onboarding_dismissed';
  let dismissed = $state(true);
  let sheetConnected = $state(false);

  onMount(async () => {
    dismissed = (await getSetting(DISMISS_KEY)) === 'true';
    sheetConnected = Boolean(await getSpreadsheetId());
  });

  const steps = $derived([
    { label: 'Connect your Google Sheet (optional)', href: '#/settings', done: sheetConnected },
    { label: 'Create your categories', href: '#/budget', done: categoriesStore.categories.length > 0 },
    { label: 'Set your income', href: '#/budget', done: budgetStore.plan !== null },
    { label: 'Add an account', href: '#/settings', done: accountsStore.accounts.length > 0 }
  ]);
  const doneCount = $derived(steps.filter((s) => s.done).length);

  async function dismiss() {
    dismissed = true;
    await setSetting(DISMISS_KEY, 'true');
  }
</script>

{#if !dismissed && doneCount < steps.length && !sampleStore.active}
  <Card>
    <div class="head">
      <h2>Get started</h2>
      <span class="progress">{doneCount}/{steps.length}</span>
    </div>
    <ol>
      {#each steps as s (s.label)}
        <li class:done={s.done}>
          <span class="mark" aria-hidden="true">{s.done ? '✓' : ''}</span>
          {#if s.done}<span>{s.label}</span>{:else}<a href={s.href}>{s.label}</a>{/if}
        </li>
      {/each}
    </ol>
    <div class="try">
      <Button variant="secondary" onclick={() => void sampleStore.load()}>Try with sample data</Button>
      <span class="hint">Demo budget, all features, no Google needed.</span>
    </div>
    <button class="link" onclick={() => void dismiss()}>I'll explore on my own</button>
  </Card>
{/if}

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: var(--font-size-base);
    margin: 0;
  }
  .progress {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  ol {
    list-style: none;
    margin: var(--space-3) 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  li {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .mark {
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
  }
  li.done span:last-child {
    color: var(--color-text-secondary);
    text-decoration: line-through;
  }
  a {
    color: var(--color-primary);
  }
  .try {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-bottom: var(--space-2);
  }
  .hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .link {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0;
    font: inherit;
    font-size: var(--font-size-sm);
  }
</style>
