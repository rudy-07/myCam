import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Calendar, Trash2, Power, Pencil, AlertTriangle, RefreshCw, Clock, Moon, Info } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Button, PageHeader, EmptyState, StatusBadge, ConfirmDialog } from '../ui';
import ScheduleFormModal from './ScheduleFormModal';
import useApiResource, { requireArray } from '../../hooks/useApiResource';
import { sendJson } from '../../lib/api';
import { API_BASE } from '../../config';
import { cameraLabel } from '../../lib/cameras';
import { DAYS, parseDays, toHHMM, isOvernight, isWindowOpenNow, summarizeDays } from '../../lib/schedule';

const ScheduleManager = ({ user }) => {
  const { addToast } = useToast();
  const userId = user?.id;
  const res = useApiResource(userId ? `${API_BASE}/api/schedules?user_id=${userId}` : null, requireArray);
  const schedules = res.data;

  const [formState, setFormState] = useState(null); // { schedule } | null  (schedule undefined = create)
  const [pendingToggle, setPendingToggle] = useState(null);
  const toggleLock = useRef(false);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteLock = useRef(false);
  const headingRef = useRef(null);

  // Re-evaluate "window open now" every 30 s. This is a clock check, not recording status.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const openNow = useMemo(() => (schedules || []).filter((s) => isWindowOpenNow(s, now)), [schedules, now]);
  const enabledCount = (schedules || []).filter((s) => s.is_active).length;

  const toggle = async (sch) => {
    if (toggleLock.current) return;
    toggleLock.current = true;
    setPendingToggle(sch.id);
    const next = !sch.is_active;
    try {
      await sendJson(`${API_BASE}/api/schedules/${sch.id}`, 'PUT', { is_active: next });
      res.setData((list) => (list || []).map((s) => (s.id === sch.id ? { ...s, is_active: next ? 1 : 0 } : s)));
      addToast(`“${sch.name}” ${next ? 'enabled' : 'disabled'}.`, 'info');
    } catch (err) {
      addToast(`The schedule was not changed: ${err.message}`, 'error', 5000);
    } finally {
      toggleLock.current = false;
      setPendingToggle(null);
    }
  };

  const remove = async () => {
    if (deleteLock.current || !confirm) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError('');
    const sch = confirm;
    try {
      await sendJson(`${API_BASE}/api/schedules/${sch.id}`, 'DELETE');
      const remaining = (schedules || []).filter((s) => s.id !== sch.id);
      res.setData(remaining);
      // Empty schedules are valid now; refresh even after deleting the final item.
      res.reload();
      addToast(`Schedule “${sch.name}” deleted.`, 'success');
      setConfirm(null);
      setTimeout(() => headingRef.current?.focus(), 0);
    } catch (err) {
      setDeleteError(`The schedule was not deleted: ${err.message}`);
      addToast(`The schedule was not deleted: ${err.message}`, 'error', 5000);
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };

  const handleSaved = (message) => {
    setFormState(null);
    addToast(message, 'success');
    res.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recording windows"
        title="Schedules"
        description="Save the days and times when a recording window should apply. Automatic recording runs only while this camera viewer is open, the camera is live, and the browser remains active. It cannot record while the browser is closed or the camera is disconnected."
        actions={<Button variant="primary" icon={Plus} onClick={() => setFormState({})}>New schedule</Button>}
      />

      {openNow.length > 0 && (
        <div role="status" className="callout callout-info">
          <Info aria-hidden="true" />
          <p>
            The current time is inside {openNow.length === 1 ? 'the window of' : 'the windows of'}{' '}
            <strong className="font-semibold">{openNow.map((s) => s.name).join(', ')}</strong>. This does not mean a recording is running; start one from the camera viewer.
          </p>
        </div>
      )}

      {schedules && res.error && (
        <div role="alert" className="callout callout-warning">
          <AlertTriangle aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
            <p>Could not refresh schedules: {res.error} Showing the last list that loaded.</p>
            <Button size="sm" icon={RefreshCw} onClick={res.reload} loading={res.refreshing}>Try again</Button>
          </div>
        </div>
      )}

      <h2 ref={headingRef} tabIndex={-1} className="sr-only">Saved schedules</h2>

      {res.loading && (
        <div role="status">
          <span className="sr-only">Loading schedules…</span>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="card h-52 animate-pulse bg-surface-sunken" />)}
          </div>
        </div>
      )}

      {!res.loading && res.error && !schedules && (
        <EmptyState
          tone="error" icon={AlertTriangle}
          title="Schedules could not be loaded"
          description={res.error}
          action={<Button icon={RefreshCw} onClick={res.reload}>Try again</Button>}
        />
      )}

      {schedules && schedules.length === 0 && !res.error && (
        <EmptyState
          icon={Calendar}
          title="No schedules saved"
          description="Create a recording window for specific hours, such as night time or weekends. Windows are saved as configuration and do not start recording by themselves. Your list stays empty until you create a schedule."
          action={<Button variant="primary" icon={Plus} onClick={() => setFormState({})}>New schedule</Button>}
        />
      )}

      {schedules && schedules.length > 0 && (
        <>
          <p className="meta-text" role="status">{schedules.length} {schedules.length === 1 ? 'schedule' : 'schedules'} · {enabledCount} enabled</p>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {schedules.map((sch) => {
              const { days, valid } = parseDays(sch.days_json);
              const start = toHHMM(sch.start_time);
              const end = toHHMM(sch.end_time);
              const enabled = Boolean(sch.is_active);
              const open = isWindowOpenNow(sch, now);
              return (
                <li key={sch.id} className="min-w-0">
                  <article className={`card card-body flex h-full flex-col gap-4 ${enabled ? 'card-selected' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={enabled ? 'info' : 'unavailable'} label={enabled ? 'Enabled' : 'Disabled'} />
                        {open && <span className="badge badge-neutral"><Clock className="size-3.5" aria-hidden="true" />Window open now</span>}
                      </div>
                      <h3 className="section-title mt-2 break-words [overflow-wrap:anywhere]">{sch.name}</h3>
                      <p className="meta-text mt-0.5">{cameraLabel(sch.camera_id)}</p>
                    </div>

                    <div className="rounded-control border border-border bg-surface-sunken p-3">
                      <p className="flex items-center gap-2 font-mono text-small text-fg">
                        <Clock className="size-4 shrink-0 text-accent" aria-hidden="true" />
                        {start || '--:--'} <span className="font-sans text-fg-subtle">to</span> {end || '--:--'}
                      </p>
                      {isOvernight(start, end) && (
                        <p className="meta-text mt-1.5 flex items-center gap-1.5"><Moon className="size-3 shrink-0" aria-hidden="true" />Overnight: ends the next day</p>
                      )}
                    </div>

                    <div>
                      {valid ? (
                        <>
                          <p className="meta-text mb-1.5">{summarizeDays(days)}</p>
                          <ul className="flex flex-wrap gap-1.5" aria-label="Active days">
                            {DAYS.map((d) => {
                              const on = days.includes(d);
                              return (
                                <li key={d} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${on ? 'bg-accent text-accent-fg' : 'bg-surface-sunken text-fg-subtle'}`}>
                                  {d}<span className="sr-only">{on ? ' (active)' : ' (inactive)'}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      ) : (
                        <p className="meta-text flex items-center gap-1.5 text-warning"><AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />The saved days could not be read. Edit this schedule to fix them.</p>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                      <Button
                        size="sm" icon={Power}
                        loading={pendingToggle === sch.id}
                        disabled={pendingToggle !== null && pendingToggle !== sch.id}
                        onClick={() => toggle(sch)}
                        aria-label={`${enabled ? 'Disable' : 'Enable'} schedule ${sch.name}`}
                      >
                        {enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" iconOnly icon={Pencil} onClick={() => setFormState({ schedule: sch })} aria-label={`Edit schedule ${sch.name}`} title="Edit schedule" />
                        <Button variant="danger-subtle" size="sm" iconOnly icon={Trash2} onClick={() => { setDeleteError(''); setConfirm(sch); }} aria-label={`Delete schedule ${sch.name}`} title="Delete schedule" />
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {formState && (
        <ScheduleFormModal user={user} schedule={formState.schedule} onClose={() => setFormState(null)} onSaved={handleSaved} />
      )}

      {confirm && (
        <ConfirmDialog
          title={`Delete schedule “${confirm.name}”?`}
          confirmLabel="Delete schedule"
          busy={deleting}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => setConfirm(null)}
        >
          <p>This removes the saved schedule. Nothing is recorded or deleted from your recordings.</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default ScheduleManager;
