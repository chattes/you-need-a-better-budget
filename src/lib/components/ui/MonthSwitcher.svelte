<script lang="ts">
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { addMonths, formatMonth } from '$lib/utils/date';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';
</script>

<nav class="month-switcher" aria-label="Month">
  <button class="nav-btn" aria-label="Previous month" onclick={() => budgetStore.setMonth(addMonths(budgetStore.month, -1))}>
    <ChevronLeft size={18} />
  </button>
  <strong>{formatMonth(budgetStore.month)}</strong>
  <button class="nav-btn" aria-label="Next month" onclick={() => budgetStore.setMonth(addMonths(budgetStore.month, 1))}>
    <ChevronRight size={18} />
  </button>
</nav>

<style>
  .month-switcher {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .nav-btn {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-1);
    color: var(--color-text);
    cursor: pointer;
    display: inline-flex;
  }
</style>
