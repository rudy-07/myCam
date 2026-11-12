import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../../src/components/Dashboard/Sidebar';
import { NAV_GROUPS, findNav, SEARCHABLE_TABS } from '../../src/components/Dashboard/navConfig';

const setup = (over = {}) => {
  const props = { isDesktop: true, isCollapsed: false, onToggle: vi.fn(), mobileOpen: false, onMobileClose: vi.fn(), onLogout: vi.fn(), activeTab: 'cameras', onTabChange: vi.fn(), ...over };
  render(<Sidebar {...props} />);
  return props;
};

describe('navConfig', () => {
  it('lists the seven dashboard sections with unique ids', () => {
    const ids = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).toEqual(['cameras', 'recordings', 'events', 'schedules', 'activity', 'broadcast', 'settings']);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('findNav resolves a section with its group, and null for unknown ids', () => {
    expect(findNav('recordings')).toMatchObject({ group: 'Monitoring', label: 'Recordings' });
    expect(findNav('settings').group).toBe('Preferences');
    expect(findNav('nope')).toBeNull();
  });
  it('only cameras and recordings are searchable', () => expect(SEARCHABLE_TABS).toEqual(['cameras', 'recordings']));
});

describe('Sidebar navigation', () => {
  it('shows every section and marks only the active one as the current page', () => {
    setup({ activeTab: 'recordings' });
    const nav = screen.getByRole('navigation', { name: 'Dashboard sections' });
    expect(within(nav).getAllByRole('button')).toHaveLength(7);
    expect(within(nav).getByRole('button', { name: /recordings/i })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: /cameras/i })).not.toHaveAttribute('aria-current');
  });
  it.each(NAV_GROUPS.flatMap((g) => g.items))('clicking %# "$label" selects $id', async ({ id, label }) => {
    const p = setup(); const user = userEvent.setup();
    await user.click(within(screen.getByRole('navigation', { name: 'Dashboard sections' })).getByRole('button', { name: new RegExp(label, 'i') }));
    expect(p.onTabChange).toHaveBeenCalledWith(id);
  });
  it('signs out', async () => {
    const p = setup(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign out|log ?out/i }));
    expect(p.onLogout).toHaveBeenCalledTimes(1);
  });
  it('collapses to icon-only buttons that keep accessible names', () => {
    setup({ isCollapsed: true });
    const nav = screen.getByRole('navigation', { name: 'Dashboard sections' });
    expect(within(nav).getByRole('button', { name: 'Cameras' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });
  it('calls onToggle from the collapse control', async () => {
    const p = setup(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(p.onToggle).toHaveBeenCalled();
  });
  it('on mobile the drawer closes with Escape and the close button', async () => {
    const p = setup({ isDesktop: false, mobileOpen: true }); const user = userEvent.setup();
    await user.keyboard('{Escape}');
    expect(p.onMobileClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(p.onMobileClose).toHaveBeenCalledTimes(2);
  });
});
