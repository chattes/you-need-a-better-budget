// Month helpers on YYYY-MM strings.

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const end = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(end).padStart(2, '0')}` };
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export function getDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'server';
  let id = localStorage.getItem('ynbb_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ynbb_device_id', id);
  }
  return id;
}

export function nowIso(): string {
  return new Date().toISOString();
}
