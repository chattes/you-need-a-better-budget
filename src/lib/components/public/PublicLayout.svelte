<script lang="ts">
  import type { Snippet } from 'svelte';
  import './public.css';

  let { children }: { children: Snippet } = $props();
</script>

<div class="public">
  <header class="pub-nav">
    <div class="container">
      <a class="pub-brand" href="#/" aria-label="You Need a Better Budget, home">
        <img src="/logo.svg" alt="" width="28" height="28" />
        <span>YNBB</span>
      </a>
      <nav class="pub-links" aria-label="Public">
        <a href="#/privacy">Privacy</a>
        <a href="#/cookies">Cookies</a>
        <a class="pub-cta" href="#/sign-in">Sign in</a>
      </nav>
    </div>
  </header>

  <main class="pub-main">
    {@render children()}
  </main>

  <footer class="pub-footer">
    <div class="container">
      <p>You Need a Better Budget is free and MIT licensed. Your data lives in your own Google Sheet.</p>
      <nav aria-label="Legal">
        <a href="#/privacy">Privacy</a>
        <a href="#/cookies">Cookies</a>
      </nav>
    </div>
  </footer>
</div>
