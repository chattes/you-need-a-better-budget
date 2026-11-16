<script lang="ts">
  import { onMount } from 'svelte';
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { snapshot, trend } from '$lib/domain/net-worth';
  import type { Account, AssetKind, LiabilityKind, NetWorthSnapshot } from '$lib/domain/types';
  import { formatCents, parseToCents } from '$lib/domain/money';
  import { getSnapshots, saveSnapshot } from '$lib/storage/indexeddb';
  import { todayIso } from '$lib/utils/date';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import TrendChart from '$lib/components/net-worth/TrendChart.svelte';

  const ASSET_KINDS: Array<{ value: AssetKind; label: string }> = [
    { value: 'cash', label: 'Cash' },
    { value: 'investment', label: 'Investment' },
    { value: 'property', label: 'Property' },
    { value: 'other', label: 'Other' }
  ];
  const LIABILITY_KINDS: Array<{ value: LiabilityKind; label: string }> = [
    { value: 'mortgage', label: 'Mortgage' },
    { value: 'car_loan', label: 'Car loan' },
    { value: 'student_loan', label: 'Student loan' },
    { value: 'personal_loan', label: 'Personal loan' },
    { value: 'other', label: 'Other' }
  ];

  let snapshots = $state<NetWorthSnapshot[]>([]);
  let period = $state<'1M' | '3M' | '6M' | '1Y'>('3M');
  let addOpen = $state(false);
  let kind = $state<'asset' | 'liability'>('asset');
  let name = $state('');
  let balance = $state('');
  let assetKind = $state<AssetKind>('other');
  let liabilityKind = $state<LiabilityKind>('other');
  let apr = $state('');
  let minPayment = $state('');
  let error = $state('');
  let editingId = $state<string | null>(null);
  let editValue = $state('');

  const today = todayIso();
  const current = $derived(snapshot(accountsStore.accounts, today));
  const points = $derived(trend(snapshots, period));

  // Manual assets are cash/chequing/savings and asset accounts; liabilities are credit cards and loans.
  const isLiability = (a: Account) => a.type === 'credit_card' || a.type === 'liability';
  const assetAccounts = $derived(accountsStore.accounts.filter((a) => !isLiability(a) && !a.is_closed && !a.deleted_at));
  const liabilityAccounts = $derived(accountsStore.accounts.filter((a) => isLiability(a) && !a.is_closed && !a.deleted_at));

  function assetGroup(a: Account): string {
    if (a.type !== 'asset') return 'Cash';
    return ASSET_KINDS.find((k) => k.value === a.asset_kind)?.label ?? 'Other';
  }
  function liabilityGroup(a: Account): string {
    if (a.type === 'credit_card') return 'Credit cards';
    return LIABILITY_KINDS.find((k) => k.value === a.liability_kind)?.label ?? 'Other';
  }

  function groupBy(list: Account[], label: (a: Account) => string) {
    const map = new Map<string, Account[]>();
    for (const a of list) {
      const key = label(a);
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return [...map.entries()];
  }

  const assetGroups = $derived(groupBy(assetAccounts, assetGroup));
  const liabilityGroups = $derived(groupBy(liabilityAccounts, liabilityGroup));

  onMount(async () => {
    snapshots = await getSnapshots();
    if (!snapshots.some((s) => s.date === today) && accountsStore.accounts.length > 0) {
      const snap = snapshot(accountsStore.accounts, today);
      await saveSnapshot(snap);
      snapshots = [...snapshots, snap];
    }
  });

  async function addItem() {
    error = '';
    const cents = parseToCents(balance || '0');
    if (!name.trim() || cents === null || cents < 0) {
      error = 'Enter a name and a balance of 0 or more.';
      return;
    }
    if (kind === 'asset') {
      const type = assetKind === 'cash' ? 'cash' : 'asset';
      const acc = await accountsStore.add({ name, type, balance: cents, is_budget_account: false });
      if (type === 'asset') await accountsStore.update(acc.id, { asset_kind: assetKind });
    } else {
      const acc = await accountsStore.add({ name, type: 'liability', balance: -cents, is_budget_account: false });
      const aprBps = apr.trim() === '' ? undefined : Math.round(Number(apr) * 100);
      const minPay = parseToCents(minPayment || '0') ?? 0;
      await accountsStore.update(acc.id, { liability_kind: liabilityKind, apr_bps: aprBps, min_payment: minPay });
    }
    name = '';
    balance = '';
    apr = '';
    minPayment = '';
    addOpen = false;
  }

  async function updateValue(a: Account) {
    const cents = parseToCents(editValue);
    if (cents === null) return;
    await accountsStore.update(a.id, { balance: isLiability(a) ? -Math.abs(cents) : cents });
    editingId = null;
  }

  async function removeItem(a: Account) {
    if (!window.confirm(`Delete ${a.name}?`)) return;
    await accountsStore.remove(a.id);
  }
</script>

<header class="page-header">
  <h1>Net Worth</h1>
  <Button onclick={() => (addOpen = true)}>Add Asset or Liability</Button>
</header>

<div class="totals">
  <Card><span class="label">Net worth</span><strong class="big" class:neg={current.net_worth < 0}>{formatCents(current.net_worth)}</strong></Card>
  <Card><span class="label">Assets</span><strong class="big">{formatCents(current.assets)}</strong></Card>
  <Card><span class="label">Liabilities</span><strong class="big">{formatCents(current.liabilities)}</strong></Card>
</div>

<section class="trend">
  <div class="trend-head">
    <h2>Trend</h2>
    <div class="chips" role="group" aria-label="Period">
      {#each ['1M', '3M', '6M', '1Y'] as p (p)}
        <button class:on={period === p} onclick={() => (period = p as typeof period)}>{p}</button>
      {/each}
    </div>
  </div>
  {#if points.length === 0}
    <p class="muted">The first snapshot is saved when you open this page.</p>
  {:else}
    <TrendChart {points} />
  {/if}
</section>

<div class="columns">
  <section>
    <h2>Assets</h2>
    {#if assetAccounts.length === 0}<p class="muted">No assets yet.</p>{/if}
    {#each assetGroups as [label, list] (label)}
      <h3>{label}</h3>
      <ul>
        {#each list as a (a.id)}
          <li>
            <span>{a.name}</span>
            {#if editingId === a.id}
              <form class="inline" onsubmit={(e) => { e.preventDefault(); void updateValue(a); }}>
                <input inputmode="decimal" bind:value={editValue} aria-label="New balance" />
                <Button type="submit">Save</Button>
              </form>
            {:else}
              <span>{formatCents(a.balance)}</span>
              <button class="link" onclick={() => { editingId = a.id; editValue = String(a.balance / 100); }}>Update value</button>
              <button class="link danger" onclick={() => void removeItem(a)}>Delete</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/each}
  </section>

  <section>
    <h2>Liabilities</h2>
    {#if liabilityAccounts.length === 0}<p class="muted">No liabilities yet.</p>{/if}
    {#each liabilityGroups as [label, list] (label)}
      <h3>{label}</h3>
      <ul>
        {#each list as a (a.id)}
          <li>
            <span>{a.name}</span>
            <span>{formatCents(Math.abs(a.balance))}</span>
            <button class="link danger" onclick={() => void removeItem(a)}>Delete</button>
          </li>
        {/each}
      </ul>
    {/each}
  </section>
</div>

<Dialog open={addOpen} title="Add asset or liability" onclose={() => (addOpen = false)}>
  <form class="form" onsubmit={(e) => { e.preventDefault(); void addItem(); }}>
    <div class="chips" role="group" aria-label="Kind">
      <button type="button" class:on={kind === 'asset'} onclick={() => (kind = 'asset')}>Asset</button>
      <button type="button" class:on={kind === 'liability'} onclick={() => (kind = 'liability')}>Liability</button>
    </div>
    {#if kind === 'asset'}
      <Field label="Type">
        <select bind:value={assetKind}>
          {#each ASSET_KINDS as k (k.value)}<option value={k.value}>{k.label}</option>{/each}
        </select>
      </Field>
    {:else}
      <Field label="Type">
        <select bind:value={liabilityKind}>
          {#each LIABILITY_KINDS as k (k.value)}<option value={k.value}>{k.label}</option>{/each}
        </select>
      </Field>
      <Field label="APR % (optional)"><input inputmode="decimal" bind:value={apr} /></Field>
      <Field label="Minimum payment (optional)"><input inputmode="decimal" bind:value={minPayment} /></Field>
    {/if}
    <Field label="Name"><input bind:value={name} required /></Field>
    <Field label="Balance"><input inputmode="decimal" bind:value={balance} /></Field>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">
      <Button variant="secondary" onclick={() => (addOpen = false)}>Cancel</Button>
      <Button type="submit">{kind === 'asset' ? 'Add Asset' : 'Add Liability'}</Button>
    </div>
  </form>
</Dialog>

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }
  h1 {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-base);
    margin: 0 0 var(--space-2);
  }
  h3 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-secondary);
    margin: var(--space-3) 0 var(--space-1);
  }
  .totals {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .totals :global(.card) {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .label {
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
  .big {
    font-size: var(--font-size-xl);
  }
  .trend {
    margin-bottom: var(--space-6);
  }
  .trend-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .chips {
    display: flex;
    gap: var(--space-1);
  }
  .chips button {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 2px var(--space-3);
    color: var(--color-text-secondary);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-sm);
  }
  .chips button.on {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-sm);
  }
  .inline {
    display: flex;
    gap: var(--space-2);
  }
  .inline input {
    width: 8rem;
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
  .link.danger {
    color: var(--color-negative);
  }
  .neg {
    color: var(--color-negative);
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: min(420px, 90vw);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .error {
    color: var(--color-negative);
  }
  @media (max-width: 901px) {
    .totals,
    .columns {
      grid-template-columns: 1fr;
    }
  }
</style>
