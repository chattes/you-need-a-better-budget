<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open = false,
    title,
    onclose,
    children
  }: { open: boolean; title: string; onclose: () => void; children: Snippet } = $props();

  let dialogEl: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) dialogEl.showModal();
    if (!open && dialogEl.open) dialogEl.close();
  });

  function handleCancel(e: Event) {
    e.preventDefault();
    onclose();
  }
</script>

<dialog bind:this={dialogEl} oncancel={handleCancel} onclick={(e) => e.target === dialogEl && onclose()}>
  <div class="dialog-inner" role="document">
    <header class="dialog-header">
      <h2>{title}</h2>
      <button class="close" aria-label="Close dialog" onclick={onclose}>×</button>
    </header>
    <div class="dialog-body">
      {@render children()}
    </div>
  </div>
</dialog>

<style>
  dialog {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0;
    max-width: 560px;
    width: calc(100vw - 2rem);
    background: var(--color-surface);
    color: var(--color-text);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.4);
  }
  .dialog-inner {
    padding: var(--space-6);
  }
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }
  .dialog-header h2 {
    margin: 0;
    font-size: var(--font-size-lg);
  }
  .close {
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--color-text-secondary);
  }
</style>
