import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Plus, Trash2, Save, Undo2, X, MapPinned, RefreshCw, AlertTriangle, Radio, Hexagon } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config';
import { Button, Field, PageHeader, EmptyState, ConfirmDialog } from '../ui';
import ZoneStage from './ZoneStage';
import useApiResource, { requireArray } from '../../hooks/useApiResource';
import { sendJson } from '../../lib/api';
import { cameraLabel, BROADCASTER_ID } from '../../lib/cameras';
import { parseCoordinates, validateDraft, MIN_POINTS, MAX_NAME_LENGTH } from '../../lib/zones';
import { formatDateTime } from '../../lib/recordingMedia';
import { CAMERA_STATUS } from '../../lib/cameraStatus';

const INSTRUCTIONS = 'Click or tap the camera picture to place each corner of the zone. With a keyboard, focus the picture, move the crosshair with the arrow keys (hold Shift for bigger steps), press Enter to place a corner and Backspace to remove the last one.';

const ActivityZones = ({ user, onNavigate }) => {
  const { addToast } = useToast();
  const userId = user?.id;
  const zonesRes = useApiResource(userId ? `${API_BASE}/api/zones?user_id=${userId}` : null, requireArray);
  const zones = zonesRes.data;

  const [cameraStatus, setCameraStatus] = useState(CAMERA_STATUS.CONNECTING);
  const live = cameraStatus === CAMERA_STATUS.LIVE;

  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [announce, setAnnounce] = useState('');
  const saveLock = useRef(false);
  const nameRef = useRef(null);
  const headingRef = useRef(null);

  const [confirmZone, setConfirmZone] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteLock = useRef(false);

  const errors = useMemo(() => validateDraft({ name, points }), [name, points]);

  const startDrawing = () => { setDrawing(true); setPoints([]); setName(''); setSubmitted(false); setSaveError(''); setAnnounce('Drawing started. No corners placed yet.'); };
  const stopDrawing = () => { setDrawing(false); setPoints([]); setName(''); setSubmitted(false); setSaveError(''); setAnnounce(''); };

  const addPoint = useCallback((p) => {
    setPoints((prev) => { const next = [...prev, p]; setAnnounce(`Corner ${next.length} placed.`); return next; });
  }, []);
  const undo = useCallback(() => {
    setPoints((prev) => { if (!prev.length) return prev; setAnnounce(`Corner ${prev.length} removed. ${prev.length - 1} placed.`); return prev.slice(0, -1); });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (saveLock.current) return;
    setSubmitted(true);
    if (Object.keys(errors).length) { if (errors.name) nameRef.current?.focus(); return; }
    saveLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await sendJson(`${API_BASE}/api/zones`, 'POST', {
        user_id: userId, camera_id: BROADCASTER_ID, name: name.trim(), coordinates: points,
      });
      addToast('Zone saved.', 'success');
      stopDrawing();
      zonesRes.reload();
    } catch (err) {
      setSaveError(err.message);
      addToast(`The zone was not saved: ${err.message}`, 'error', 5000);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const openDelete = (zone) => { setDeleteError(''); setConfirmZone(zone); };
  const handleDelete = async () => {
    if (deleteLock.current || !confirmZone) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError('');
    const zone = confirmZone;
    try {
      await sendJson(`${API_BASE}/api/zones/${zone.id}`, 'DELETE');
      addToast(`Zone “${zone.name}” deleted.`, 'success');
      zonesRes.setData((list) => (list || []).filter((z) => z.id !== zone.id));
      setConfirmZone(null);
      zonesRes.reload();
      setTimeout(() => headingRef.current?.focus(), 0);
    } catch (err) {
      setDeleteError(`The zone was not deleted: ${err.message}`);
      addToast(`The zone was not deleted: ${err.message}`, 'error', 5000);
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Motion alerts"
        title="Activity zones"
        description="Mark areas of the camera picture. While the camera viewer is open, live, and motion detection is on, movement inside a saved zone saves a snapshot and sends an alert. Detection compares video frames, so it reacts to any change in the picture (people, pets, shadows or lighting) and does not identify what moved."
        actions={!drawing && (
          <Button variant="primary" icon={Plus} onClick={startDrawing} disabled={!live}>New zone</Button>
        )}
      />

      {!live && (
        <div role="status" className="callout callout-info">
          <Radio aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {cameraStatus === CAMERA_STATUS.CONNECTING
                ? 'Connecting to the camera. Zones are drawn over the live picture, so drawing starts once the camera is live.'
                : 'The camera is not live, so there is no picture to draw on. Start broadcasting from a device with a camera, then return here.'}
            </p>
            {onNavigate && <Button size="sm" onClick={() => onNavigate('broadcast')}>Open Broadcast</Button>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-4">
          <ZoneStage
            zones={zones || []}
            drawing={drawing}
            points={points}
            onAddPoint={addPoint}
            onUndo={undo}
            onStatusChange={setCameraStatus}
            describedBy="zone-instructions"
          />
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-small text-fg-muted" aria-label="Legend">
            <li className="flex items-center gap-2"><span className="size-3.5 rounded-sm border-2 border-success bg-success-soft" aria-hidden="true" />Saved zone (solid green outline)</li>
            <li className="flex items-center gap-2"><span className="size-3.5 rounded-sm border-2 border-dashed border-accent bg-accent-soft" aria-hidden="true" />Draft zone (dashed blue outline)</li>
          </ul>
        </div>

        <div className="min-w-0 space-y-6">
          {drawing && (
            <form onSubmit={handleSave} noValidate className="card card-body space-y-4" aria-labelledby="draft-heading">
              <h2 id="draft-heading" className="section-title flex items-center gap-2"><Hexagon className="size-[1.125rem] text-accent" aria-hidden="true" />New zone</h2>
              <p id="zone-instructions" className="text-small text-fg-muted">{INSTRUCTIONS}</p>

              <Field label="Zone name" error={submitted ? errors.name : undefined}>
                <input ref={nameRef} type="text" className="input" value={name} maxLength={MAX_NAME_LENGTH + 20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front door" autoComplete="off" />
              </Field>

              <div>
                <p className="text-small font-medium text-fg">
                  Corners placed: <span className="font-mono">{points.length}</span>
                  <span className="font-normal text-fg-subtle"> (at least {MIN_POINTS})</span>
                </p>
                {submitted && errors.points && <p role="alert" className="field-error">{errors.points}</p>}
                {!live && <p role="status" className="meta-text mt-1.5">The camera is not live. Your corners are kept, but you can only add more once it is live again.</p>}
              </div>

              {saveError && (
                <div role="alert" className="callout callout-danger"><AlertTriangle aria-hidden="true" /><p>The zone was not saved: {saveError} Your drawing is still here.</p></div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" icon={Save} loading={saving}>{saving ? 'Saving…' : 'Save zone'}</Button>
                <Button icon={Undo2} onClick={undo} disabled={points.length === 0 || saving}>Undo corner</Button>
                <Button variant="ghost" icon={X} onClick={stopDrawing} disabled={saving}>Cancel</Button>
              </div>
              <p className="sr-only" role="status" aria-live="polite">{announce}</p>
            </form>
          )}

          <section className="card card-body" aria-labelledby="zones-heading">
            <h2 id="zones-heading" ref={headingRef} tabIndex={-1} className="section-title mb-4 flex items-center gap-2 outline-none">
              <MapPinned className="size-[1.125rem] text-accent" aria-hidden="true" />
              Saved zones
              {zones && <span className="badge badge-neutral font-mono">{zones.length}</span>}
            </h2>

            {zonesRes.loading && (
              <div role="status">
                <span className="sr-only">Loading zones…</span>
                <div className="space-y-3" aria-hidden="true">
                  {[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-control bg-surface-sunken" />)}
                </div>
              </div>
            )}

            {!zonesRes.loading && zonesRes.error && !zones && (
              <EmptyState
                tone="error" icon={AlertTriangle} className="!px-4 !py-8"
                title="Zones could not be loaded"
                description={zonesRes.error}
                action={<Button icon={RefreshCw} onClick={zonesRes.reload}>Try again</Button>}
              />
            )}

            {zones && zonesRes.error && (
              <div role="alert" className="callout callout-warning mb-4">
                <AlertTriangle aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p>Could not refresh zones: {zonesRes.error} Showing the last list that loaded.</p>
                  <Button size="sm" icon={RefreshCw} onClick={zonesRes.reload} loading={zonesRes.refreshing}>Try again</Button>
                </div>
              </div>
            )}

            {zones && zones.length === 0 && !zonesRes.error && (
              <div className="py-6 text-center">
                <p className="text-small font-medium text-fg">No zones saved yet</p>
                <p className="mx-auto mt-1 max-w-xs text-small text-fg-muted">
                  Until you save a zone, motion anywhere in the camera view raises an alert. Choose New zone to draw one and limit alerts to that area.
                </p>
              </div>
            )}

            {zones && zones.length > 0 && (
              <ul className="space-y-3">
                {zones.map((zone) => {
                  const pts = parseCoordinates(zone.coordinates_json);
                  const created = formatDateTime(zone.created_at);
                  return (
                    <li key={zone.id} className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-sunken p-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-small font-semibold text-fg [overflow-wrap:anywhere]">{zone.name}</h3>
                        <p className="meta-text mt-0.5">{cameraLabel(zone.camera_id)}</p>
                        <p className="meta-text">
                          {pts ? `${pts.length} corners` : 'Shape unreadable'}{created ? ` · ${created}` : ''}
                        </p>
                      </div>
                      <Button variant="danger-subtle" size="sm" iconOnly icon={Trash2} onClick={() => openDelete(zone)} aria-label={`Delete zone ${zone.name}`} title="Delete zone" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {confirmZone && (
        <ConfirmDialog
          title={`Delete zone “${confirmZone.name}”?`}
          confirmLabel="Delete zone"
          busy={deleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => setConfirmZone(null)}
        >
          <p>This removes the saved zone. Movement in that area will no longer raise a zone alert unless another zone covers it.</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default ActivityZones;
