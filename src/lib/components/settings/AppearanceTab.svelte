<script lang="ts">
  import { onMount } from 'svelte';
  import { getSetting, setSetting } from '$lib/storage/indexeddb';
  import Card from '../ui/Card.svelte';

  let theme = $state<'light' | 'dark'>('light');

  onMount(async () => {
    const saved = await getSetting('theme');
    if (saved === 'dark') theme = 'dark';
    apply(theme);
  });

  function apply(value: 'light' | 'dark') {
    document.documentElement.dataset.theme = value === 'dark' ? 'dark' : '';
  }

  async function choose(value: 'light' | 'dark') {
    theme = value;
    apply(value);
    await setSetting('theme', value);
  }
</script>

<Card>
  <h2>Appearance</h2>
  <div class="theme-picker" role="radiogroup" aria-label="Theme">
    <button class="theme" class:active={theme === 'light'} role="radio" aria-checked={theme === 'light'} onclick={() => void choose('light')}>
      Light
    </button>
    <button class="theme" class:active={theme === 'dark'} role="radio" aria-checked={theme === 'dark'} onclick={() => void choose('dark')}>
      Dark
    </button>
  </div>
</Card>

<style>
  .theme-picker {
    display: flex;
    gap: var(--space-2);
  }
  .theme {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-4);
  }
  .theme.active {
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }
</style>
