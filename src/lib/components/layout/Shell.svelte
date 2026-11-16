<script lang="ts">
  import { onMount } from 'svelte';
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { goalsStore } from '$lib/stores/goals.svelte';
  import { scheduledStore } from '$lib/stores/scheduled.svelte';
  import { subscriptionsStore } from '$lib/stores/subscriptions.svelte';
  import { navigationStore } from '$lib/stores/navigation.svelte';
  import { labelsStore } from '$lib/stores/rules.svelte';
  import { sampleStore } from '$lib/stores/sample.svelte';
  import { location } from 'svelte-spa-router';
  import Toast from '../ui/Toast.svelte';
  import QuickAdd from './QuickAdd.svelte';
  import {
    LayoutDashboard,
    ArrowLeftRight,
    Wallet,
    CalendarDays,
    Target,
    Landmark,
    ChartColumn,
    Repeat,
    Settings,
    MoreHorizontal,
    Plus,
    ChevronDown
  } from 'lucide-svelte';

  let { children }: { children?: import('svelte').Snippet } = $props();

  let moreOpen = $state(false);
  let quickAddOpen = $state(false);
  let collapsed = $state<Record<string, boolean>>({});

  // Spec §2.1 sidebar groups, in order. Household and Money Coach are not built (see PROGRESS.md).
  const groups = [
    {
      name: 'Overview',
      items: [
        { href: '#/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '#/transactions', label: 'Activity', icon: ArrowLeftRight },
        { href: '#/budget', label: 'Budget', icon: Wallet }
      ]
    },
    {
      name: 'Plan',
      items: [
        { href: '#/calendar', label: 'Calendar', icon: CalendarDays },
        { href: '#/goals', label: 'Goals', icon: Target }
      ]
    },
    {
      name: 'Insights',
      items: [
        { href: '#/net-worth', label: 'Net Worth', icon: Landmark },
        { href: '#/reports', label: 'Reports', icon: ChartColumn },
        { href: '#/subscriptions', label: 'Subscriptions', icon: Repeat }
      ]
    }
  ];

  onMount(() => {
    void accountsStore.load();
    void categoriesStore.load();
    void budgetStore.load();
    void transactionsStore.load();
    void goalsStore.load();
    void scheduledStore.load();
    void subscriptionsStore.load();
    void navigationStore.load();
    void labelsStore.load();
    void sampleStore.refresh();
  });
</script>

<div class="shell">
  <nav class="sidebar" aria-label="Primary">
    <a class="brand" href="#/" aria-label="You Need a Better Budget, home"><img src="/logo.svg" alt="" width="28" height="28" /><span>YNBB</span></a>
    {#each groups as group (group.name)}
      {@const visible = group.items.filter((i) => !navigationStore.isHidden(i.href))}
      {#if visible.length > 0}
      <section class="nav-group">
        <button
          class="group-title"
          aria-expanded={!collapsed[group.name]}
          onclick={() => (collapsed[group.name] = !collapsed[group.name])}
        >
          <span>{group.name}</span>
          <span class="chev" class:closed={collapsed[group.name]}><ChevronDown size={14} /></span>
        </button>
        {#if !collapsed[group.name]}
          {#each visible as item (item.href)}
            <a href={item.href} aria-current={$location === item.href.slice(1) ? 'page' : undefined}><item.icon size={18} /><span>{item.label}</span></a>
          {/each}
        {/if}
      </section>
      {/if}
    {/each}
    <section class="nav-group">
      <a href="#/settings" aria-current={$location === '/settings' ? 'page' : undefined}><Settings size={18} /><span>Settings</span></a>
    </section>
  </nav>

  <main class="shell-main">
    {#if sampleStore.active}
      <div class="sample-badge" role="status">Sample data · <a href="#/settings">Clear</a></div>
    {/if}
    {#if children}
      {@render children()}
    {/if}
  </main>

  <button
    class="fab"
    aria-label="Quick add"
    onclick={() => {
      moreOpen = false;
      quickAddOpen = true;
    }}
  >
    <Plus size={24} />
  </button>

  <nav class="bottom-nav" aria-label="Mobile">
    <a href="#/" aria-label="Home" aria-current={$location === '/' ? 'page' : undefined}><LayoutDashboard size={20} /><span>Home</span></a>
    <a href="#/transactions" aria-label="Activity" aria-current={$location === '/transactions' ? 'page' : undefined}><ArrowLeftRight size={20} /><span>Activity</span></a>
    <a href="#/budget" aria-label="Budget" aria-current={$location === '/budget' ? 'page' : undefined}><Wallet size={20} /><span>Budget</span></a>
    <a href="#/calendar" aria-label="Calendar" aria-current={$location === '/calendar' ? 'page' : undefined}><CalendarDays size={20} /><span>Calendar</span></a>
    <a href="#/goals" aria-label="Goals" aria-current={$location === '/goals' ? 'page' : undefined}><Target size={20} /><span>Goals</span></a>
    <button aria-label="More" aria-expanded={moreOpen} aria-haspopup="menu" onclick={() => (moreOpen = !moreOpen)}>
      <MoreHorizontal size={20} /><span>More</span>
    </button>
  </nav>

  {#if moreOpen}
    <div class="more-backdrop" role="presentation" onclick={() => (moreOpen = false)}></div>
    <div class="more-sheet" role="menu" aria-label="More">
      <a href="#/net-worth" role="menuitem" onclick={() => (moreOpen = false)}><Landmark size={18} />Net Worth</a>
      <a href="#/reports" role="menuitem" onclick={() => (moreOpen = false)}><ChartColumn size={18} />Reports</a>
      <a href="#/subscriptions" role="menuitem" onclick={() => (moreOpen = false)}><Repeat size={18} />Subscriptions</a>
      <a href="#/settings" role="menuitem" onclick={() => (moreOpen = false)}><Settings size={18} />Settings</a>
    </div>
  {/if}

  <QuickAdd open={quickAddOpen} onclose={() => (quickAddOpen = false)} />
  <Toast />
</div>

<style>
  .shell {
    --bottom-bar: 4rem;
    display: flex;
    min-height: 100vh;
  }
  .sidebar {
    width: 230px;
    padding: var(--space-6) var(--space-4);
    border-right: 1px solid var(--color-border);
    background: var(--color-surface);
    font-size: var(--font-size-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 700;
    color: var(--color-text);
    text-decoration: none;
    font-size: var(--font-size-lg);
    letter-spacing: -0.01em;
  }
  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .group-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    padding: var(--space-1) var(--space-3);
    color: var(--color-text-secondary);
    margin-top: var(--space-2);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .chev {
    transition: transform 0.15s;
  }
  .chev.closed {
    transform: rotate(-90deg);
  }
  .sidebar a {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-text);
    text-decoration: none;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-weight: 500;
  }
  .sidebar a:hover {
    background: var(--color-surface-alt);
  }
  .sidebar a[aria-current='page'] {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
    font-weight: 600;
  }
  .shell-main {
    flex: 1;
    min-width: 0;
    max-width: 1200px;
    padding: var(--space-6);
  }
  .sample-badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-warning);
    border: 1px solid var(--color-warning);
    border-radius: 999px;
    padding: 2px var(--space-3);
    margin-bottom: var(--space-3);
  }
  .sample-badge a {
    color: inherit;
  }
  .bottom-nav,
  .fab,
  .more-sheet,
  .more-backdrop {
    display: none;
  }
  @media (max-width: 901px) {
    .sidebar {
      display: none;
    }
    .shell {
      display: block;
    }
    .shell-main {
      padding: var(--space-4);
      /* Clears the bottom bar and the + button, so the last row stays visible. */
      padding-bottom: calc(var(--bottom-bar) + 5rem);
    }
    .fab {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      right: var(--space-4);
      bottom: calc(var(--bottom-bar) + var(--space-3));
      width: 3.25rem;
      height: 3.25rem;
      border-radius: 50%;
      border: none;
      background: var(--color-primary);
      color: var(--color-on-primary);
      z-index: 15;
      box-shadow: var(--shadow-fab);
      cursor: pointer;
    }
    .bottom-nav {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: var(--bottom-bar);
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      box-shadow: var(--shadow-raised);
      z-index: 14;
    }
    .bottom-nav a[aria-current='page'] {
      color: var(--color-primary);
      font-weight: 600;
    }
    .bottom-nav a,
    .bottom-nav button {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: var(--space-2) 0;
      color: var(--color-text-secondary);
      text-decoration: none;
      font-size: 0.7rem;
      background: none;
      border: none;
      cursor: pointer;
    }
    .more-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.35);
      z-index: 12;
      cursor: default;
    }
    .more-sheet {
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      right: 0;
      /* Sits above the bottom bar, so the bar (and More, to close) stays tappable. */
      bottom: var(--bottom-bar);
      background: var(--color-surface);
      border-radius: var(--radius-md) var(--radius-md) 0 0;
      box-shadow: var(--shadow-raised);
      padding: var(--space-3) 0 var(--space-4);
      z-index: 13;
    }
    .more-sheet a {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      color: var(--color-text);
      text-decoration: none;
      font-size: var(--font-size-base);
    }
  }
</style>
