<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { authStore } from '$lib/stores/auth.svelte';
  import { sampleStore } from '$lib/stores/sample.svelte';
  import { connectGoogleSheet } from '$lib/services/connect';
  import { getDb } from '$lib/storage/indexeddb';

  // "Try with sample data" only makes sense in an empty browser. Real data is never overwritten.
  let hasData = $state(true);
  let working = $state(false);
  let error = $state('');

  onMount(async () => {
    const db = await getDb();
    hasData = (await db.count('accounts')) + (await db.count('transactions')) > 0;
  });

  async function google() {
    working = true;
    error = '';
    try {
      await connectGoogleSheet();
      push('/');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Connection failed';
    } finally {
      working = false;
    }
  }

  async function sample() {
    working = true;
    error = '';
    try {
      await sampleStore.load();
      push('/');
    } finally {
      working = false;
    }
  }
</script>

<div class="start">
  <button class="btn-lg google-btn" disabled={!authStore.configured || working} onclick={() => void google()}>
    Continue with Google
  </button>
  <button class="btn-lg secondary-btn" disabled={working || hasData} onclick={() => void sample()}>
    Try with sample data
  </button>
</div>
{#if !authStore.configured}
  <p class="start-note">Google sign-in is not set up yet. Add a Google client ID in <a href="#/settings">Settings</a>, or see the self-hosting guide.</p>
{/if}
{#if hasData}
  <p class="start-note">You already have data here. <a href="#/">Open your budget</a>.</p>
{/if}
{#if error}
  <p class="start-error" role="alert">{error}</p>
{/if}

<style>
  .google-btn {
    border: 1px solid var(--color-primary);
    color: var(--color-on-primary);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.15) 0%, rgb(255 255 255 / 0) 100%), var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary), inset 0 1px 1px rgb(255 255 255 / 0.07), 0 1px 1px rgb(0 0 0 / 0.24);
  }
  .google-btn:hover:not(:disabled) {
    background: var(--color-primary-strong);
  }
  .secondary-btn {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-input);
  }
  .secondary-btn:hover:not(:disabled) {
    background: var(--color-surface-alt);
  }
  .btn-lg:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
