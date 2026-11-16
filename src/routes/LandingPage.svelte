<script lang="ts">
  import PublicLayout from '$lib/components/public/PublicLayout.svelte';
  import StartButtons from '$lib/components/public/StartButtons.svelte';

  const features = [
    { title: 'Give every dollar a job', text: 'Assign money to categories each month. Your left-to-assign number is always the same on every screen.' },
    { title: 'Track activity', text: 'Accounts, transactions, splits and transfers. Import or export a CSV whenever you like.' },
    { title: 'Plan ahead', text: 'Calendar of upcoming bills, savings goals, debt payoff plans and a list of subscriptions.' },
    { title: 'Your data, your sheet', text: 'Your budget is saved in a Google Sheet in your own Drive. We never see it.' }
  ];
</script>

<svelte:head>
  <title>You Need a Better Budget</title>
</svelte:head>

<PublicLayout>
  <section class="container hero">
    <h1>You Need a Better Budget</h1>
    <p class="lead">A free, open-source budget that runs in your browser. Your data stays in your own Google Sheet.</p>
    <StartButtons />
    <p class="small">Free and open source. No analytics.</p>
  </section>

  <section class="container features" aria-label="What you get">
    {#each features as f (f.title)}
      <article class="feature">
        <h2>{f.title}</h2>
        <p>{f.text}</p>
      </article>
    {/each}
  </section>
</PublicLayout>
