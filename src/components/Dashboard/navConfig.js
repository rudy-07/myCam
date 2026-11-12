import { Camera, Video, Settings, Activity, Users, Clock, ListChecks } from 'lucide-react';

/** Single source of truth for dashboard navigation (sidebar, drawer, top-bar context). */
export const NAV_GROUPS = [
  {
    heading: 'Monitoring',
    items: [
      { id: 'cameras', icon: Camera, label: 'Cameras' },
      { id: 'recordings', icon: Video, label: 'Recordings' },
      { id: 'events', icon: ListChecks, label: 'Event Timeline' },
      { id: 'schedules', icon: Clock, label: 'Schedules' },
      { id: 'activity', icon: Activity, label: 'Activity Zones' },
      { id: 'broadcast', icon: Users, label: 'Broadcast' },
    ],
  },
  { heading: 'Preferences', items: [{ id: 'settings', icon: Settings, label: 'Settings' }] },
];

export const findNav = (id) => {
  for (const g of NAV_GROUPS) {
    const item = g.items.find((i) => i.id === id);
    if (item) return { group: g.heading, ...item };
  }
  return null;
};

/** Tabs where the top-bar search actually filters content. */
export const SEARCHABLE_TABS = ['cameras', 'recordings'];
