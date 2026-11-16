import { getSetting, setSetting } from '$lib/storage/indexeddb';

/** Sidebar items the user hid (spec §3.9 Navigation). Stored as JSON in the settings table. */
const KEY = 'navigation_hidden';

function createNavigationStore() {
  let hidden = $state<string[]>([]);

  async function load() {
    try {
      const raw = await getSetting(KEY);
      hidden = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      hidden = [];
    }
  }

  async function setHidden(href: string, isHidden: boolean) {
    const next = isHidden ? [...new Set([...hidden, href])] : hidden.filter((h) => h !== href);
    hidden = next;
    await setSetting(KEY, JSON.stringify(next));
  }

  return {
    get hidden() {
      return hidden;
    },
    load,
    setHidden,
    isHidden: (href: string) => hidden.includes(href)
  };
}

export const navigationStore = createNavigationStore();
