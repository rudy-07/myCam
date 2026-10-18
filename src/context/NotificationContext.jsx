import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { API_BASE } from '../config';
import { authFetch } from '../lib/api';

const NotificationContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
};

const MAX_EVENTS = 100;
const DEFAULT_PREFERENCES = { motionAlerts: true, dashboardToasts: true, browserNotifications: false };

export const NotificationProvider = ({ children }) => {
  const [events, setEvents] = useState([]);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const refreshAlerts = useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE}/api/alerts?limit=${MAX_EVENTS}`);
      if (!response.ok) return false;
      const rows = await response.json();
      if (!Array.isArray(rows)) return false;
      setEvents(rows.map((row) => ({ ...row, read: Boolean(row.isRead), cameraId: row.cameraId || undefined })));
      return true;
    } catch { /* Keep the current in-memory history if the API is unavailable. */ return false; }
  }, []);

  const refreshPreferences = useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE}/api/alert-preferences`);
      if (response.ok) setPreferences({ ...DEFAULT_PREFERENCES, ...(await response.json()) });
    } catch { /* Defaults remain available while offline. */ }
    finally { setPreferencesLoaded(true); }
  }, []);

  useEffect(() => { void refreshAlerts(); void refreshPreferences(); }, [refreshAlerts, refreshPreferences]);

  const pushEvent = useCallback((event) => {
    setEvents((prev) => {
      if (prev.some((e) => String(e.id) === String(event.id) || (e.timestamp === event.timestamp && e.message === event.message && e.cameraId === event.cameraId))) return prev;
      return [{ read: false, ...event, id: event.id || `${event.timestamp}-${Math.random().toString(36).slice(2, 8)}` }, ...prev].slice(0, MAX_EVENTS);
    });
  }, []);

  const clearEvents = useCallback(async () => {
    const response = await authFetch(`${API_BASE}/api/alerts`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Could not clear server alert history.');
    setEvents([]);
  }, []);

  const markAllRead = useCallback(async () => {
    const ids = events.filter((event) => !event.read && /^\d+$/.test(String(event.id))).map((event) => String(event.id));
    setEvents((prev) => prev.map((event) => ({ ...event, read: true, isRead: true })));
    if (ids.length) {
      try { await authFetch(`${API_BASE}/api/alerts/read`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); }
      catch { /* UI state is optimistic; next refresh reconciles it. */ }
    }
  }, [events]);

  const updatePreferences = useCallback(async (next) => {
    const previous = preferences;
    setPreferences(next);
    try {
      const response = await authFetch(`${API_BASE}/api/alert-preferences`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error('Could not save notification preferences.');
      setPreferences({ ...DEFAULT_PREFERENCES, ...(await response.json()) });
    } catch (error) { setPreferences(previous); throw error; }
  }, [preferences]);

  const triggerAlert = useCallback(async ({ type = 'activity', message = 'Activity detected', cameraId = null }) => {
    try {
      const res = await authFetch(`${API_BASE}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, cameraId }),
      });
      if (res.ok) {
        const data = await res.json();
        pushEvent({
          id: data.id,
          type: data.type,
          message: data.message,
          cameraId: data.cameraId,
          timestamp: data.timestamp,
          read: false,
        });
        return data;
      }
    } catch (err) {
      console.warn('Failed to trigger alert:', err);
    }
    return null;
  }, [pushEvent]);

  const value = useMemo(() => ({
    events,
    pushEvent,
    triggerAlert,
    clearEvents,
    markAllRead,
    preferences,
    preferencesLoaded,
    updatePreferences,
    refreshAlerts,
  }), [events, pushEvent, triggerAlert, clearEvents, markAllRead, preferences, preferencesLoaded, updatePreferences, refreshAlerts]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};
