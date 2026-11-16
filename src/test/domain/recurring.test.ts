import { describe, expect, it } from 'vitest';
import { detectRecurring } from '$lib/domain/scheduled';
import { transaction } from './fixtures';

describe('recurring detection (spec §8 MUST)', () => {
  it('same description and amount in two contiguous months is a suggestion', () => {
    const rows = [
      transaction({ id: 'a', date: '2026-09-10', amount: -1500, description: 'Internet & Phone' }),
      transaction({ id: 'b', date: '2026-10-10', amount: -1500, description: 'Internet & Phone' }),
      transaction({ id: 'c', date: '2026-10-12', amount: -999, description: 'Coffee' })
    ];
    const out = detectRecurring(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.description).toBe('Internet & Phone');
    expect(out[0]!.months).toBe(2);
    expect(out[0]!.lastDate).toBe('2026-10-10');
  });

  it('gaps in months break the run; transfers are ignored', () => {
    const rows = [
      transaction({ id: 'a', date: '2026-08-01', amount: -500, description: 'Gym' }),
      transaction({ id: 'b', date: '2026-10-01', amount: -500, description: 'Gym' }),
      transaction({ id: 'c', date: '2026-08-02', amount: -700, type: 'transfer', description: 'Card' }),
      transaction({ id: 'd', date: '2026-09-02', amount: -700, type: 'transfer', description: 'Card' })
    ];
    expect(detectRecurring(rows)).toEqual([]);
  });
});
