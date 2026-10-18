import React, { useState } from 'react';
import { BellRing, MonitorCheck, RadioTower } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { PageHeader } from '../ui';
import StorageSettings from './StorageSettings';
import ProfileSettings from './ProfileSettings';

const AlertPreferences = () => {
  const { preferences, preferencesLoaded, updatePreferences, triggerAlert } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = async (key, checked) => {
    const next = { ...preferences, [key]: checked };
    setSaving(true); setError('');
    try {
      if (key === 'browserNotifications' && checked && 'Notification' in window && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Browser notifications were not permitted.');
      }
      await updatePreferences(next);
    } catch (err) { setError(err.message || 'Could not save preferences.'); }
    finally { setSaving(false); }
  };
  const options = [
    { key: 'motionAlerts', title: 'Motion alerts', description: 'Store and notify about motion events from camera broadcasters.', icon: RadioTower },
    { key: 'dashboardToasts', title: 'Dashboard toast messages', description: 'Show a short in-app message when an alert arrives.', icon: BellRing },
    { key: 'browserNotifications', title: 'Browser notifications', description: 'Show system notifications while myCam is open and permission is granted.', icon: MonitorCheck },
  ];
  return (
    <section className="surface-card space-y-4 p-5" aria-labelledby="alert-preferences-title">
      <div><h2 id="alert-preferences-title" className="text-base font-semibold text-fg">Alerts &amp; notifications</h2><p className="mt-1 text-small text-fg-muted">Choose which alert channels myCam uses. Email and SMS delivery are not configured.</p></div>
      {!preferencesLoaded && <p className="text-small text-fg-muted">Loading saved preferences…</p>}
      <div className="divide-y divide-border">
        {options.map(({ key, title, description, icon: Icon }) => (
          <label key={key} className="flex cursor-pointer items-start gap-3 py-4">
            <span className="mt-0.5 rounded-control bg-surface-sunken p-2 text-accent">{React.createElement(Icon, { className: 'size-4', 'aria-hidden': true })}</span>
            <span className="min-w-0 flex-1"><span className="block text-small font-semibold text-fg">{title}</span><span className="mt-1 block text-small text-fg-muted">{description}</span></span>
            <input type="checkbox" className="mt-1 size-4 accent-[var(--color-accent)]" checked={Boolean(preferences[key])} disabled={saving || !preferencesLoaded} onChange={(e) => change(key, e.target.checked)} aria-label={title} />
          </label>
        ))}
      </div>
      {saving && <p className="text-small text-fg-muted" role="status">Saving preferences…</p>}
      {error && <p className="text-small text-danger" role="alert">{error}</p>}

      <div className="pt-2 border-t border-border flex items-center justify-between">
        <p className="text-xs text-fg-muted">Verify your in-app toasts and system alerts.</p>
        <button
          type="button"
          onClick={() => {
            triggerAlert?.({
              type: 'activity',
              message: 'Security test alert: myCam alert notification system is operational!',
              cameraId: 'system'
            });
          }}
          className="btn btn-secondary btn-sm"
        >
          Send Test Notification
        </button>
      </div>
    </section>
  );
};

const Settings = ({ user, onUserUpdate }) => (
  <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader
      eyebrow="Preferences"
      title="Settings"
      description="Choose how recording storage quotas are counted and keep your profile details up to date."
    />
    <AlertPreferences />
    <StorageSettings user={user} />
    <ProfileSettings user={user} onUserUpdate={onUserUpdate} />
  </div>
);

export default Settings;
