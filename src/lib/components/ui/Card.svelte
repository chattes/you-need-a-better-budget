<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="card">
  {@render children()}
</div>

<style>
  .card {
    background: var(--color-surface);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    box-shadow: var(--shadow-card);
  }
</style>
