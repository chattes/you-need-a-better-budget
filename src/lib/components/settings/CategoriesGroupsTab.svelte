<script lang="ts">
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import Card from '../ui/Card.svelte';
  import Button from '../ui/Button.svelte';
</script>

<Card>
  <h2>Categories & groups</h2>
  {#if categoriesStore.groups.length === 0}
    <p class="muted">No groups yet. Create them on the Budget page.</p>
  {:else}
    {#each categoriesStore.groups as group (group.id)}
      <h3 class="group-name">{group.name}</h3>
      <ul class="cat-list">
        {#each categoriesStore.categories.filter((c) => c.group_id === group.id) as category (category.id)}
          <li>
            <span class:archived={category.is_archived}>
              {category.name}
              {#if category.is_archived}<em class="muted">(archived)</em>{/if}
            </span>
            <Button
              variant="ghost"
              onclick={() => categoriesStore.archive(category.id, !category.is_archived)}
            >
              {category.is_archived ? 'Unarchive' : 'Archive'}
            </Button>
          </li>
        {/each}
      </ul>
    {/each}
  {/if}
</Card>

<style>
  .group-name {
    margin: var(--space-4) 0 var(--space-2);
    font-size: var(--font-size-base);
  }
  .cat-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .cat-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
  }
  .archived {
    color: var(--color-text-secondary);
    text-decoration: line-through;
  }
  .muted {
    color: var(--color-text-secondary);
    font-style: normal;
  }
</style>
