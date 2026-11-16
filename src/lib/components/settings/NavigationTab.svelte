<script lang="ts">
  import { navigationStore } from '$lib/stores/navigation.svelte';
  import { NAV_ITEMS } from '$lib/components/layout/nav';
  import Card from '../ui/Card.svelte';
</script>

<Card>
  <h2>Navigation</h2>
  <p class="muted">Choose which items show in the sidebar. Settings always stays.</p>
  <ul>
    {#each NAV_ITEMS as item (item.href)}
      <li>
        <label>
          <input
            type="checkbox"
            checked={!navigationStore.isHidden(item.href)}
            onchange={(e) => void navigationStore.setHidden(item.href, !(e.currentTarget as HTMLInputElement).checked)}
          />
          {item.group}: {item.label}
        </label>
      </li>
    {/each}
  </ul>
</Card>

<style>
  h2 {
    font-size: var(--font-size-base);
    margin: 0 0 var(--space-2);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  label {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
</style>
