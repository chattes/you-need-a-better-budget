<script lang="ts">
  import type { Snippet } from 'svelte';

  let { label, children, hint }: { label: string; children: Snippet; hint?: string } = $props();
</script>

<label class="field">
  <span class="field-label">{label}</span>
  {@render children()}
  {#if hint}
    <span class="field-hint">{hint}</span>
  {/if}
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }
  .field-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
  }
  .field-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .field :global(input),
  .field :global(select) {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    color: var(--color-text);
  }
</style>
