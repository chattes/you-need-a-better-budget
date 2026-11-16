import { accountsStore } from './accounts.svelte';
import { categoriesStore } from './categories.svelte';
import { budgetStore } from './budget.svelte';
import { transactionsStore } from './transactions.svelte';
import { goalsStore } from './goals.svelte';
import { scheduledStore } from './scheduled.svelte';
import { subscriptionsStore } from './subscriptions.svelte';
import { labelsStore } from './rules.svelte';
import { clearSampleData, isSampleActive, loadSampleData } from '$lib/sample/sample-data';
import { todayIso } from '$lib/utils/date';

/** Test mode state: is sample data loaded (drives the header badge and the Connect block). */
function createSampleStore() {
  let active = $state(false);

  /** Reloads every in-memory store from IndexedDB after a sample load or clear. */
  async function reloadAll() {
    await Promise.all([
      accountsStore.load(),
      categoriesStore.load(),
      budgetStore.load(),
      transactionsStore.load(),
      goalsStore.load(),
      scheduledStore.load(),
      subscriptionsStore.load(),
      labelsStore.load()
    ]);
  }

  async function refresh() {
    active = await isSampleActive();
  }

  async function load() {
    await loadSampleData(todayIso());
    await reloadAll();
    active = true;
  }

  async function clear() {
    await clearSampleData();
    await reloadAll();
    active = false;
  }

  return {
    get active() {
      return active;
    },
    refresh,
    load,
    clear,
    reloadAll
  };
}

export const sampleStore = createSampleStore();
