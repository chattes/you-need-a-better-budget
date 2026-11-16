<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant = 'primary',
    type = 'button',
    disabled = false,
    onclick,
    children
  }: {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    type?: 'button' | 'submit';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  } = $props();
</script>

<button class="btn btn-{variant}" {type} {disabled} {onclick}>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-4);
    min-height: 36px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    line-height: 1.2;
    transition: background-color 0.15s, box-shadow 0.15s;
  }
  .btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .btn-primary {
    background: linear-gradient(180deg, rgb(255 255 255 / 0.15) 0%, rgb(255 255 255 / 0) 100%), var(--color-primary);
    color: var(--color-on-primary);
    box-shadow: 0 0 0 1px var(--color-primary), inset 0 1px 1px rgb(255 255 255 / 0.07), 0 1px 1px rgb(0 0 0 / 0.24);
  }
  .btn-primary:hover {
    background: var(--color-primary-strong);
  }
  .btn-secondary {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text);
    box-shadow: var(--shadow-input);
  }
  .btn-secondary:hover {
    background: var(--color-surface-alt);
  }
  .btn-danger {
    background: var(--color-negative);
    color: var(--color-on-primary);
  }
  .btn-ghost {
    background: transparent;
    color: var(--color-text);
  }
</style>
