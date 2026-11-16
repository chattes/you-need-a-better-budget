<script lang="ts" module>
  let toasts = $state<Array<{ id: number; message: string }>>([]);
  let nextId = 0;

  export function showToast(message: string): void {
    const id = ++nextId;
    toasts = [...toasts, { id, message }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 4000);
  }
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts as toast (toast.id)}
    <div class="toast">{toast.message}</div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    bottom: var(--space-6);
    right: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    z-index: 100;
  }
  .toast {
    background: var(--color-text);
    color: var(--color-bg);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
  }
</style>
