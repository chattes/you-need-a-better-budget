<script lang="ts">
  import AccountsSection from '$lib/components/settings/AccountsSection.svelte';
  import DataSourceTab from '$lib/components/settings/DataSourceTab.svelte';
  import SampleDataCard from '$lib/components/settings/SampleDataCard.svelte';
  import CategoriesGroupsTab from '$lib/components/settings/CategoriesGroupsTab.svelte';
  import ImportExportTab from '$lib/components/settings/ImportExportTab.svelte';
  import AppearanceTab from '$lib/components/settings/AppearanceTab.svelte';
  import DangerZoneTab from '$lib/components/settings/DangerZoneTab.svelte';
  import RulesTagsTab from '$lib/components/settings/RulesTagsTab.svelte';
  import NavigationTab from '$lib/components/settings/NavigationTab.svelte';

  type TabKey =
    | 'data-source'
    | 'accounts'
    | 'categories'
    | 'rules'
    | 'import-export'
    | 'appearance'
    | 'navigation'
    | 'danger';
  const TABS: Array<{ key: TabKey; label: string }> = [
    { key: 'data-source', label: 'Google Sheets' },
    { key: 'accounts', label: 'Accounts' },
    { key: 'categories', label: 'Categories & groups' },
    { key: 'rules', label: 'Rules & tags' },
    { key: 'import-export', label: 'Import & export' },
    { key: 'appearance', label: 'Appearance' },
    { key: 'navigation', label: 'Navigation' },
    { key: 'danger', label: 'Danger zone' }
  ];
  let tab = $state<TabKey>('data-source');
</script>

<h1>Settings</h1>

<div class="tabs" role="tablist">
  {#each TABS as t (t.key)}
    <button
      class="tab"
      class:active={tab === t.key}
      role="tab"
      aria-selected={tab === t.key}
      onclick={() => (tab = t.key)}
    >
      {t.label}
    </button>
  {/each}
</div>

<div class="sections">
  {#if tab === 'data-source'}
    <DataSourceTab />
    <SampleDataCard />
  {:else if tab === 'accounts'}
    <AccountsSection />
  {:else if tab === 'rules'}
    <RulesTagsTab />
  {:else if tab === 'navigation'}
    <NavigationTab />
  {:else if tab === 'categories'}
    <CategoriesGroupsTab />
  {:else if tab === 'import-export'}
    <ImportExportTab />
  {:else if tab === 'appearance'}
    <AppearanceTab />
  {:else}
    <DangerZoneTab />
  {/if}
</div>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-6);
  }
  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) var(--space-3);
    color: var(--color-text-secondary);
    font-weight: 600;
  }
  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }
  .sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
</style>
