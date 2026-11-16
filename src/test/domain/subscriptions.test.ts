import { describe, expect, it } from 'vitest';
import { annualCost, annualTotal, upcomingCharges } from '$lib/domain/subscriptions';
import type { Subscription } from '$lib/domain/types';

const sub = (over: Partial<Subscription>): Subscription => ({
  id: over.id ?? 's',
  merchant_name: 'Streamer',
  amount: 1599,
  cadence: 'monthly',
  next_charge_date: '2026-12-01',
  category_id: null,
  account_id: null,
  is_detected: false,
  created_at: '',
  updated_at: '',
  device_id: 'd',
  deleted_at: null,
  ...over
});

describe('subscriptions', () => {
  it('annual cost: weekly ×52, monthly ×12, quarterly ×4, yearly ×1', () => {
    expect(annualCost(1000, 'weekly')).toBe(52000);
    expect(annualCost(1599, 'monthly')).toBe(19188);
    expect(annualCost(1000, 'quarterly')).toBe(4000);
    expect(annualCost(12000, 'yearly')).toBe(12000);
  });

  it('annual total skips deleted rows', () => {
    const subs = [sub({ id: 'a' }), sub({ id: 'b', deleted_at: '2026-01-01' })];
    expect(annualTotal(subs)).toBe(19188);
  });

  it('upcoming charges are filtered by date window and sorted', () => {
    const subs = [
      sub({ id: 'late', next_charge_date: '2026-12-20' }),
      sub({ id: 'soon', next_charge_date: '2026-12-02' }),
      sub({ id: 'past', next_charge_date: '2026-11-01' })
    ];
    expect(upcomingCharges(subs, '2026-12-01', '2026-12-07').map((s) => s.id)).toEqual(['soon']);
  });
});
