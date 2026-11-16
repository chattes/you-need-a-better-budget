import { LayoutDashboard, ArrowLeftRight, Wallet, CalendarDays, Target, Landmark, ChartColumn, Repeat } from 'lucide-svelte';

/** Sidebar items in spec §2.1 order. Also used by Settings > Navigation. */
export const NAV_ITEMS = [
  { href: '#/', label: 'Dashboard', group: 'Overview', icon: LayoutDashboard },
  { href: '#/transactions', label: 'Activity', group: 'Overview', icon: ArrowLeftRight },
  { href: '#/budget', label: 'Budget', group: 'Overview', icon: Wallet },
  { href: '#/calendar', label: 'Calendar', group: 'Plan', icon: CalendarDays },
  { href: '#/goals', label: 'Goals', group: 'Plan', icon: Target },
  { href: '#/net-worth', label: 'Net Worth', group: 'Insights', icon: Landmark },
  { href: '#/reports', label: 'Reports', group: 'Insights', icon: ChartColumn },
  { href: '#/subscriptions', label: 'Subscriptions', group: 'Insights', icon: Repeat }
];
