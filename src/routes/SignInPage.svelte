<script lang="ts">
  import PublicLayout from '$lib/components/public/PublicLayout.svelte';
  import StartButtons from '$lib/components/public/StartButtons.svelte';
</script>

<svelte:head>
  <title>Sign in · You Need a Better Budget</title>
</svelte:head>

<PublicLayout>
  <section class="container signin">
    <img src="/logo.svg" alt="" width="48" height="48" />
    <h1>Sign in to YNBB</h1>
    <p class="lead">Your data stays in your own Google Sheet.</p>
    <StartButtons />
  </section>
</PublicLayout>
