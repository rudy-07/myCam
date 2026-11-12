import React, { useMemo, useState } from 'react';
import { Activity, RefreshCw, Download, Search, CircleAlert, CheckCircle2, Clock3, FilterX, Link2, ExternalLink, Unlink } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { Button, PageHeader, EmptyState } from '../ui';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config';
import { authFetch } from '../../lib/api';

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};
const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const Events = ({ user, onOpenRecording }) => {
  const { events, refreshAlerts, markAllRead } = useNotifications();
  const { addToast } = useToast();
  const [query, setQuery] = useState('');
  const [cameraFilter, setCameraFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [recordings, setRecordings] = useState([]);
  const [selectedRecording, setSelectedRecording] = useState({});
  const [linkingEventId, setLinkingEventId] = useState(null);

  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await authFetch(`${API_BASE}/api/recordings`, { signal: controller.signal });
        if (!response.ok) throw new Error('Could not load recording metadata');
        const rows = await response.json();
        if (Array.isArray(rows)) setRecordings(rows);
      } catch (loadError) { if (loadError.name !== 'AbortError') console.warn('Recording metadata unavailable for event links', loadError); }
    })();
    return () => controller.abort();
  }, [user?.id]);

  const updateRecordingLink = async (event, recordingId) => {
    setLinkingEventId(String(event.id)); setError('');
    try {
      const response = await authFetch(`${API_BASE}/api/alerts/${encodeURIComponent(event.id)}/recording`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: recordingId ? Number(recordingId) : null }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not link recording.');
      const ok = await refreshAlerts();
      if (!ok) throw new Error('Link saved, but event history could not be refreshed.');
      addToast(recordingId ? 'Recording linked to event' : 'Recording unlinked from event', 'success');
    } catch (linkError) { setError(linkError.message || 'Could not update recording link.'); }
    finally { setLinkingEventId(null); }
  };

  const cameraIds = useMemo(() => [...new Set(events.map((event) => event.cameraId).filter(Boolean))].sort(), [events]);
  const eventTypes = useMemo(() => [...new Set(events.map((event) => String(event.type || 'activity').toLowerCase()))].sort(), [events]);
  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (cameraFilter !== 'all' && event.cameraId !== cameraFilter) return false;
      if (typeFilter !== 'all' && String(event.type || 'activity').toLowerCase() !== typeFilter) return false;
      if (readFilter === 'unread' && (event.read || event.isRead)) return false;
      if (readFilter === 'read' && !(event.read || event.isRead)) return false;
      if (needle && ![event.message, event.cameraId, event.type].some((value) => String(value || '').toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [events, query, cameraFilter, typeFilter, readFilter]);

  const reload = async () => {
    setRefreshing(true);
    setError('');
    try {
      const ok = await refreshAlerts();
      if (!ok) throw new Error('Refresh failed');
      addToast('Event history refreshed', 'success');
    } catch {
      setError('Could not refresh events. Check the server connection and try again.');
    } finally { setRefreshing(false); }
  };

  const exportCsv = () => {
    if (!filteredEvents.length) return;
    const rows = [
      ['Timestamp', 'Camera', 'Type', 'Message', 'Read status'],
      ...filteredEvents.map((event) => [event.timestamp, event.cameraId || 'Unknown camera', event.type || 'activity', event.message, (event.read || event.isRead) ? 'Read' : 'Unread']),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mycam-events-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => { setQuery(''); setCameraFilter('all'); setTypeFilter('all'); setReadFilter('all'); };
  const unreadCount = events.filter((event) => !(event.read || event.isRead)).length;
  const motionCount = events.filter((event) => String(event.type || '').toLowerCase() === 'motion').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monitoring"
        title="Event timeline"
        description="Review persisted camera activity and filter events by camera, type, or read status."
        actions={<>
          <Button variant="secondary" onClick={reload} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </Button>
          <Button onClick={exportCsv} disabled={!filteredEvents.length}>
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </Button>
        </>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex size-10 items-center justify-center rounded-control bg-accent/10 text-accent"><Activity className="size-5" aria-hidden="true" /></span>
          <div><p className="meta-text">Events retained</p><p className="text-heading font-semibold tabular-nums">{events.length}</p></div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex size-10 items-center justify-center rounded-control bg-warning/10 text-warning"><CircleAlert className="size-5" aria-hidden="true" /></span>
          <div><p className="meta-text">Unread events</p><p className="text-heading font-semibold tabular-nums">{unreadCount}</p></div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex size-10 items-center justify-center rounded-control bg-success/10 text-success"><CheckCircle2 className="size-5" aria-hidden="true" /></span>
          <div><p className="meta-text">Motion events</p><p className="text-heading font-semibold tabular-nums">{motionCount}</p></div>
        </div>
      </div>

      <section className="card space-y-4 p-4 md:p-5" aria-label="Event filters">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5"><span className="meta-text">Search events</span><span className="input-icon-wrap"><Search aria-hidden="true" /><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Message, camera, type…" /></span></label>
          <label className="space-y-1.5"><span className="meta-text">Camera</span><select className="input" value={cameraFilter} onChange={(event) => setCameraFilter(event.target.value)}><option value="all">All cameras</option>{cameraIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
          <label className="space-y-1.5"><span className="meta-text">Event type</span><select className="input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All event types</option>{eventTypes.map((type) => <option key={type} value={type}>{type === 'motion' ? 'Motion detected' : type.charAt(0).toUpperCase() + type.slice(1)}</option>)}</select></label>
          <label className="space-y-1.5"><span className="meta-text">Read status</span><select className="input" value={readFilter} onChange={(event) => setReadFilter(event.target.value)}><option value="all">All statuses</option><option value="unread">Unread</option><option value="read">Read</option></select></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-small text-fg-muted">Showing <strong className="text-fg">{filteredEvents.length}</strong> of {events.length} retained events</p>
          <div className="flex flex-wrap gap-2">
            {(query || cameraFilter !== 'all' || typeFilter !== 'all' || readFilter !== 'all') && <Button variant="ghost" onClick={resetFilters}><FilterX className="size-4" aria-hidden="true" /> Clear filters</Button>}
            {unreadCount > 0 && <Button variant="secondary" onClick={() => void markAllRead()}>Mark all read</Button>}
          </div>
        </div>
      </section>

      {error && <div role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-small text-danger">{error}</div>}

      {filteredEvents.length === 0 ? (
        <EmptyState icon={Activity} title={events.length ? 'No matching events' : 'No camera events yet'} description={events.length ? 'Try adjusting your filters to see more of the timeline.' : 'Motion events appear after a signed-in browser broadcaster detects frame changes and the server saves the alert.'} action={events.length ? <Button variant="secondary" onClick={resetFilters}>Clear filters</Button> : undefined} />
      ) : (
        <section className="card overflow-hidden" aria-label="Camera event history">
          <ol className="divide-y divide-border">
            {filteredEvents.map((event) => {
              const isRead = Boolean(event.read || event.isRead);
              const isMotion = String(event.type || '').toLowerCase() === 'motion';
              return <li key={event.id} className={`flex gap-3 p-4 md:gap-4 md:px-5 ${isRead ? '' : 'bg-accent/[0.035]'}`}>
                <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ${isMotion ? 'bg-warning/10 text-warning' : 'bg-accent/10 text-accent'}`}><Activity className="size-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-small font-semibold text-fg">{event.message || 'Camera activity reported'}</p>
                    {!isRead && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Unread</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                    <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />{formatDate(event.timestamp)}</span>
                    <span>Camera: {event.cameraId || 'Unknown'}</span>
                    <span className="rounded-full border border-border px-2 py-0.5">{isMotion ? 'Motion' : String(event.type || 'activity')}</span>
                    {event.recordingId && <span className="rounded-full border border-success/30 bg-success/5 px-2 py-0.5 text-success">Recording linked · #{event.recordingId}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`event-recording-${event.id}`}>Link recording to this event</label>
                    <select id={`event-recording-${event.id}`} className="input max-w-xs" value={selectedRecording[event.id] ?? (event.recordingId ? String(event.recordingId) : '')} onChange={(e) => setSelectedRecording((prev) => ({ ...prev, [event.id]: e.target.value }))} disabled={linkingEventId === String(event.id)}>
                      <option value="">{recordings.length ? 'Choose a recording…' : 'No recordings available'}</option>
                      {recordings.filter((recording) => !event.cameraId || !recording.camera_id || recording.camera_id === event.cameraId).map((recording) => <option key={recording.id} value={String(recording.id)}>#{recording.id} · {recording.camera_id || 'Camera'} · {formatDate(recording.created_at)}</option>)}
                    </select>
                    <Button size="sm" variant="secondary" onClick={() => void updateRecordingLink(event, selectedRecording[event.id] ?? (event.recordingId ? String(event.recordingId) : ''))} disabled={linkingEventId === String(event.id) || !(selectedRecording[event.id] ?? (event.recordingId ? String(event.recordingId) : ''))}>
                      <Link2 className="size-3.5" aria-hidden="true" /> {linkingEventId === String(event.id) ? 'Saving…' : 'Link recording'}
                    </Button>
                    {event.recordingId && <>
                      <Button size="sm" onClick={() => onOpenRecording?.(event.recordingId)}><ExternalLink className="size-3.5" aria-hidden="true" /> Open recording</Button>
                      <Button size="sm" variant="ghost" onClick={() => void updateRecordingLink(event, null)} disabled={linkingEventId === String(event.id)} aria-label="Unlink recording"><Unlink className="size-3.5" aria-hidden="true" /></Button>
                    </>}
                  </div>
                </div>
              </li>;
            })}
          </ol>
        </section>
      )}
      <p className="meta-text">Link an event to an existing recording from your account. The server validates that the event and recording belong to you and rejects cross-camera links when camera IDs are known. This timeline does not create missing clips automatically. The current motion signal uses browser-side frame differencing.</p>
    </div>
  );
};

export default Events;
