<script lang="ts">
  import Router, { location as route } from 'svelte-spa-router';
  import wrap from 'svelte-spa-router/wrap';
  import Shell from '$lib/components/layout/Shell.svelte';
  import Toast from '$lib/components/ui/Toast.svelte';
  import DashboardPage from './routes/DashboardPage.svelte';
  import BudgetPage from './routes/BudgetPage.svelte';
  import TransactionsPage from './routes/TransactionsPage.svelte';
  import GoalsPage from './routes/GoalsPage.svelte';
  import CalendarPage from './routes/CalendarPage.svelte';
  import SettingsPage from './routes/SettingsPage.svelte';
  import AccountRegisterPage from './routes/AccountRegisterPage.svelte';
  import SubscriptionsPage from './routes/SubscriptionsPage.svelte';
  import LandingPage from './routes/LandingPage.svelte';
  import SignInPage from './routes/SignInPage.svelte';
  import PrivacyPage from './routes/PrivacyPage.svelte';
  import CookiesPage from './routes/CookiesPage.svelte';
  import { onMount } from 'svelte';
  import { getDb, takeResetNotice } from '$lib/storage/indexeddb';
  import { sampleStore } from '$lib/stores/sample.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { showToast } from '$lib/components/ui/Toast.svelte';

  // Does this browser hold any budget data? Decides whether "/" shows the landing page.
  let hasData = $state<boolean | null>(null);

  async function checkData() {
    const db = await getDb();
    hasData = (await db.count('accounts')) + (await db.count('transactions')) > 0;
  }

  onMount(() => {
    void authStore.load();
    // One-time notice after the v1 → v2 local reset (docs/plan.md v2 rebuild).
    void getDb().then(async (db) => {
      if (takeResetNotice()) {
        showToast('YNBB is now v2. Local data was reset. Your Google Sheet was not changed; reconnect it in Settings.');
      }
      // Test mode: ?demo=1 loads the sample budget, but only into an empty browser.
      const demo = new URLSearchParams(window.location.search).get('demo') === '1';
      if (demo && (await db.count('accounts')) === 0 && (await db.count('transactions')) === 0) {
        await sampleStore.load();
        showToast('Sample data loaded (test mode).');
      } else {
        await sampleStore.refresh();
      }
      await checkData();
    });
  });

  // Re-check after sample data is loaded or cleared, or after connecting.
  $effect(() => {
    void sampleStore.active;
    void authStore.connected;
    void checkData();
  });

  // Landing: no data, not connected, no sample data. Shown without the app shell.
  const landing = $derived(hasData === false && !authStore.connected && !sampleStore.active);

  const publicRoutes = {
    '/': LandingPage,
    '/sign-in': SignInPage,
    '/sign-up': SignInPage,
    '/privacy': PrivacyPage,
    '/cookies': CookiesPage
  };
  const publicPaths = ['/sign-in', '/sign-up', '/privacy', '/cookies'];
  const isPublic = $derived(publicPaths.includes($route) || (landing && ($route === '/' || $route === '')));

  const routes = {
    '/': DashboardPage,
    '/budget': BudgetPage,
    '/transactions': TransactionsPage,
    '/calendar': CalendarPage,
    '/goals': GoalsPage,
    '/accounts/:id': AccountRegisterPage,
    '/subscriptions': SubscriptionsPage,
    // Lazy-loaded: keeps Chart.js out of the initial bundle.
    '/reports': wrap({ asyncComponent: () => import('./routes/ReportsPage.svelte') }),
    '/net-worth': wrap({ asyncComponent: () => import('./routes/NetWorthPage.svelte') }),
    '/settings': SettingsPage,
    '*': DashboardPage
  };
</script>

{#if hasData === null}
  <!-- Checking local data first, so the landing page never flashes. -->
{:else if isPublic}
  <Router routes={publicRoutes} />
  <Toast />
{:else}
  <Shell>
    <Router {routes} />
  </Shell>
{/if}
