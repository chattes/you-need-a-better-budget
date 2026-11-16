<script lang="ts">
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { normalizeSplitAmounts } from '$lib/domain/splits';
  import Button from '../ui/Button.svelte';
  import { Plus, Trash2 } from 'lucide-svelte';

  let {
    parentAmount,
    splits = $bindable([])
  }: {
    parentAmount: number; // cents, signed by transaction type
    splits: Array<{ category_id: string; dollars: string; memo: string }>;
  } = $props();

  let categories = $derived(
    categoriesStore.activeCategories.filter((c) => c.type === 'expense')
  );
  // Users type positive magnitudes; the sign follows the parent type.
  let parentAbs = $derived(Math.abs(parentAmount));
  let total = $derived(
    Math.round(splits.reduce((sum, s) => sum + Math.abs(Number(s.dollars || '0')) * 100, 0))
  );
  let valid = $derived(splits.length > 0 && total === parentAbs);

  function addRow() {
    splits = [...splits, { category_id: categories[0]?.id ?? '', dollars: '', memo: '' }];
  }
  function removeRow(index: number) {
    splits = splits.filter((_, i) => i !== index);
  }

  export function isValid(): boolean {
    return valid;
  }
  export function toCents() {
    const magnitudes = splits.map((s) => Math.round(Math.abs(Number(s.dollars || '0')) * 100));
    return normalizeSplitAmounts(parentAmount, magnitudes).map((amount, i) => ({
      category_id: splits[i]!.category_id,
      amount,
      memo: splits[i]!.memo
    }));
  }
</script>

<div class="split-editor">
  <h3>Split transaction</h3>
  {#each splits as split, i (i)}
    <div class="split-row">
      <select bind:value={split.category_id} aria-label="Split category">
        {#each categories as category (category.id)}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
      <input bind:value={split.dollars} inputmode="decimal" placeholder="0.00" aria-label="Split amount" />
      <input bind:value={split.memo} placeholder="Memo" aria-label="Split memo" />
      <Button variant="ghost" onclick={() => removeRow(i)} aria-label="Remove split row">
        <Trash2 size={16} />
      </Button>
    </div>
  {/each}
  <div class="split-footer">
    <Button variant="secondary" onclick={addRow}><Plus size={16} /> Add split</Button>
    <span class="sum" class:invalid={!valid}>
      {#if valid}
        {(total / 100).toFixed(2)} of {(parentAbs / 100).toFixed(2)}
      {:else}
        Splits add up to ${(total / 100).toFixed(2)}; transaction total is ${(parentAbs / 100).toFixed(2)}.
      {/if}
    </span>
  </div>
</div>

<style>
  .split-editor {
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    margin-top: var(--space-3);
  }
  .split-editor h3 {
    font-size: var(--font-size-sm);
    margin: 0 0 var(--space-2);
  }
  .split-row {
    display: grid;
    grid-template-columns: 1fr 6rem 1fr auto;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .split-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }
  .sum {
    font-size: var(--font-size-sm);
    color: var(--color-positive);
  }
  .sum.invalid {
    color: var(--color-negative);
  }
</style>
