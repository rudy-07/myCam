import React, { useEffect, useRef } from 'react';
import { LogOut, ChevronLeft, ChevronRight, X } from 'lucide-react';
import logoIcon from '../../assets/mycam_no_text.png';
import { NAV_GROUPS } from './navConfig';

/**
 * One sidebar, two presentations:
 *  - desktop (md+): static column, expanded 240px or collapsed 76px rail
 *  - mobile: off-canvas drawer with backdrop. While closed it is `inert`, so
 *    nothing inside can be focused or read by assistive tech.
 */
const Sidebar = ({ isDesktop, isCollapsed, onToggle, mobileOpen, onMobileClose, onLogout, activeTab, onTabChange }) => {
  const asideRef = useRef(null);
  const closeRef = useRef(null);
  const drawerOpen = !isDesktop && mobileOpen;
  const collapsed = isDesktop && isCollapsed; // the drawer is always full width

  // Drawer behaviour: focus in, Escape, Tab containment, scroll lock.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') { onMobileClose(); return; }
      if (e.key !== 'Tab') return;
      const items = asideRef.current?.querySelectorAll('button:not([disabled]), a[href]');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, onMobileClose]);

  const select = (id) => { onTabChange(id); if (!isDesktop) onMobileClose(); };

  const positioning = isDesktop
    ? 'relative z-30 h-full shrink-0'
    : `fixed inset-y-0 left-0 z-[60] w-[min(18rem,85vw)] transition-transform duration-200 ${drawerOpen ? 'translate-x-0 shadow-overlay' : '-translate-x-full'}`;

  return (
    <>
      {drawerOpen && (
        <div className="fixed inset-0 z-[55] bg-overlay animate-fade-in" onClick={onMobileClose} aria-hidden="true" />
      )}
      <aside
        id="app-sidebar"
        ref={asideRef}
        inert={!isDesktop && !mobileOpen}
        aria-label="Primary"
        style={isDesktop ? { width: collapsed ? 76 : 240 } : undefined}
        className={`flex flex-col border-r border-border bg-surface ${isDesktop ? 'transition-[width] duration-200' : ''} ${positioning}`}
      >
        <div className={`flex h-[68px] shrink-0 items-center border-b border-border px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <button
            type="button"
            onClick={() => select('cameras')}
            className="flex min-w-0 items-center gap-3 rounded-control"
            aria-label="myCam, go to Cameras"
          >
            <img src={logoIcon} alt="" width="32" height="32" className="size-8 shrink-0 object-contain" />
            {!collapsed && (
              <span className="whitespace-nowrap text-heading font-bold tracking-tight text-fg">my<span className="text-accent">Cam</span></span>
            )}
          </button>
          {!isDesktop && (
            <button ref={closeRef} type="button" onClick={onMobileClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Close navigation">
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Dashboard sections">
          {NAV_GROUPS.map(({ heading, items }) => (
            <div key={heading}>
              {collapsed
                ? <div className="mx-3 mb-2 border-t border-border first:hidden" aria-hidden="true" />
                : <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-fg-subtle">{heading}</p>}
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => select(item.id)}
                      aria-current={activeTab === item.id ? 'page' : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`nav-item min-h-11 ${collapsed ? 'justify-center px-0' : ''}`}
                    >
                      <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-border p-3">
          {isDesktop && (
            <button
              type="button"
              onClick={onToggle}
              className={`nav-item min-h-10 ${collapsed ? 'justify-center px-0' : ''}`}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar' : undefined}
            >
              {collapsed ? <ChevronRight className="size-[18px]" aria-hidden="true" /> : <><ChevronLeft className="size-[18px]" aria-hidden="true" /><span>Collapse</span></>}
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            aria-label={collapsed ? 'Sign out' : undefined}
            title={collapsed ? 'Sign out' : undefined}
            className={`btn btn-danger-subtle btn-block ${collapsed ? 'px-0' : 'justify-start'}`}
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
