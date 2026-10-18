import React, { useState, useRef } from 'react';
import { HardDrive, Cloud, Database, RefreshCw, AlertTriangle, Save, RotateCcw, ShieldCheck, Activity, Clock, CheckCircle2, XCircle, LoaderCircle } from 'lucide-react';
import { Button, Field, EmptyState } from '../ui';
import { useToast } from '../../context/ToastContext';
import useApiResource from '../../hooks/useApiResource';
import { sendJson } from '../../lib/api';
import { API_BASE } from '../../config';

const MAX_QUOTA_MB = 10000000;

const MODES = [
  { id: 'local', Icon: HardDrive, title: 'Server storage', text: 'New recordings count against the Internal and/or SD-card quota counters. Files are saved on the myCam server.' },
  { id: 'cloud', Icon: Cloud, title: 'Cloud object storage', text: 'Store recordings in your configured private S3-compatible bucket. Requires valid server-side cloud credentials.' },
  { id: 'both', Icon: Database, title: 'Server storage + saved cloud preference', text: 'Recordings follow the local rules. The cloud quota is saved as a preference only; no cloud copy is made.' },
];

const BUCKETS = [
  { key: 'internal', label: 'Internal bucket', quotaKey: 'internal_quota_mb' },
  { key: 'sdcard', label: 'SD-card bucket', quotaKey: 'sdcard_quota_mb' },
  { key: 'cloud', label: 'Cloud bucket', quotaKey: 'cloud_quota_mb' },
];

const BUCKET_NAME = { internal: 'Internal bucket', sdcard: 'SD-card bucket', cloud: 'Cloud bucket' };

/** The status response must carry a config object. Anything else is rejected, never defaulted. */
const validateProviderStatus = (json) => {
  if (!json || typeof json !== 'object' || typeof json.configured !== 'boolean' || typeof json.connected !== 'boolean') {
    throw new Error('The server sent a response that is not cloud-provider status.');
  }
  return json;
};

const validateStatus = (json) => {
  if (!json || typeof json !== 'object' || !json.config || typeof json.config !== 'object') {
    throw new Error('The server sent a response that is not storage settings.');
  }
  return json;
};

const validateUploadDiagnostics = (json) => {
  if (!json || typeof json !== 'object' || !json.uploads || !Array.isArray(json.recent) || !Array.isArray(json.reservations)) {
    throw new Error('The server sent a response that is not upload diagnostics.');
  }
  return json;
};

const formatDateTime = (value) => {
  if (!value) return 'No activity recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
};

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Finite non-negative number, else null (so "unavailable" is never shown as 0). */
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const formatMb = (mb) => {
  if (mb === null) return 'unavailable';
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
};

const quotaError = (text) => {
  const t = String(text ?? '').trim();
  if (!/^\d+$/.test(t)) return 'Enter a whole number of MB (1 or more).';
  const n = Number(t);
  if (n < 1 || n > MAX_QUOTA_MB) return `Enter a number from 1 to ${MAX_QUOTA_MB.toLocaleString()}.`;
  return undefined;
};

/** How the server will treat each bucket for new recordings under these values (mirrors the upload route). */
const bucketRole = (key, v) => {
  if (v.mode === 'cloud') return key === 'cloud' ? 'Receives new recordings in the configured object-storage bucket' : 'Not used for new recordings';
  if (key === 'cloud') return 'Saved preference only; not used for new recordings';
  if (v.local_target === 'internal') return key === 'internal' ? 'Receives new recordings' : 'Not used for new recordings';
  if (v.local_target === 'sdcard') return key === 'sdcard' ? 'Receives new recordings' : 'Not used for new recordings';
  return key === 'internal' ? 'Receives new recordings first' : 'Receives them once the Internal quota is reached';
};

const summaryFor = (v) => {
  if (v.mode === 'cloud') return 'New recordings are uploaded to the configured cloud bucket and counted against the Cloud quota.';
  if (v.local_target === 'internal') return 'New recordings are counted against the Internal bucket.';
  if (v.local_target === 'sdcard') return 'New recordings are counted against the SD-card bucket.';
  return 'New recordings are counted against the Internal bucket until its quota is reached, then against the SD-card bucket.';
};

const baseValues = (config) => ({
  mode: ['local', 'cloud', 'both'].includes(config.mode) ? config.mode : 'local',
  local_target: ['internal', 'sdcard', 'both_failover'].includes(config.local_target) ? config.local_target : 'both_failover',
  internal_quota_mb: String(config.internal_quota_mb ?? ''),
  sdcard_quota_mb: String(config.sdcard_quota_mb ?? ''),
  cloud_quota_mb: String(config.cloud_quota_mb ?? ''),
});

const StorageSettings = ({ user }) => {
  const { addToast } = useToast();
  const res = useApiResource(user?.id ? `${API_BASE}/api/storage/status?user_id=${user.id}` : null, validateStatus);
  const status = res.data;
  const providerRes = useApiResource(user?.id ? `${API_BASE}/api/storage/provider-status` : null, validateProviderStatus);
  const provider = providerRes.data;
  const uploadsRes = useApiResource(user?.id ? `${API_BASE}/api/storage/upload-diagnostics` : null, validateUploadDiagnostics);
  const uploadDiagnostics = uploadsRes.data;

  // Form values are the server's saved values until the person edits something.
  const [edits, setEdits] = useState(null);
  const values = edits ?? (status ? baseValues(status.config) : null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const lock = useRef(false);
  const quotaRefs = { internal: useRef(null), sdcard: useRef(null), cloud: useRef(null) };

  const update = (patch) => setEdits({ ...values, ...patch });
  const saved = status ? baseValues(status.config) : null;
  const dirty = Boolean(edits && saved && Object.keys(edits).some((k) => edits[k] !== saved[k]));
  const errors = values ? Object.fromEntries(BUCKETS.map((b) => [b.key, quotaError(values[b.quotaKey])])) : {};

  const handleSave = async (e) => {
    e.preventDefault();
    if (lock.current || !values) return;
    setSubmitted(true);
    const bad = BUCKETS.find((b) => errors[b.key]);
    if (bad) { quotaRefs[bad.key].current?.focus(); return; }
    lock.current = true;
    setSaving(true);
    setSaveError('');
    const payload = {
      mode: values.mode,
      local_target: values.local_target,
      internal_quota_mb: Number(values.internal_quota_mb),
      sdcard_quota_mb: Number(values.sdcard_quota_mb),
      cloud_quota_mb: Number(values.cloud_quota_mb),
    };
    try {
      await sendJson(`${API_BASE}/api/storage/config`, 'POST', { user_id: user.id, ...payload });
      res.setData((prev) => ({ ...prev, config: { ...prev.config, ...payload } }));
      setEdits(null);
      setSubmitted(false);
      addToast('Storage settings saved.', 'success');
      res.reload(); // refresh usage and the active bucket
    } catch (err) {
      setSaveError(err.message);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const discard = () => { setEdits(null); setSubmitted(false); setSaveError(''); };

  const activeBucket = status ? (status.config.mode === 'cloud' ? 'cloud' : status.active_target) : null;
  const cloudReady = provider?.configured === true && provider?.connected === true;

  return (
    <section className="card card-body space-y-6" aria-labelledby="storage-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-control border border-border bg-surface-sunken text-accent">
            <HardDrive className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="storage-heading" className="section-title">Recording storage</h2>
            <p className="text-small text-fg-muted">Quota limits that decide when the oldest recordings are removed.</p>
          </div>
        </div>
        {status && BUCKET_NAME[activeBucket] && (
          <span className="badge badge-neutral">Counting against: {BUCKET_NAME[activeBucket]}</span>
        )}
      </div>

      <div role="note" className={`callout ${cloudReady ? 'callout-success' : 'callout-warning'}`}>
        {cloudReady ? <Cloud aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{cloudReady ? 'Cloud storage connected' : 'Cloud storage not connected'}</p>
          <p className="mt-1">{cloudReady
            ? 'The backend verified access to your configured bucket. Cloud-mode recordings are stored as private objects and streamed through the authenticated API. The SD-card bucket remains a quota counter; no physical SD card is connected.'
            : `${providerRes.loading ? 'Checking the backend cloud-storage configuration…' : providerRes.error || provider?.message || 'Configure S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY on the backend, then restart it.'} Local server storage remains available. Cloud mode cannot upload recordings until the provider check succeeds.`}</p>
          {providerRes.error && <Button size="sm" variant="ghost" icon={RefreshCw} onClick={providerRes.reload} loading={providerRes.refreshing}>Check again</Button>}
        </div>
      </div>

      {res.loading && (
        <div role="status">
          <span className="sr-only">Loading storage settings…</span>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-card bg-surface-sunken" />)}
          </div>
        </div>
      )}

      {!res.loading && !status && res.error && (
        <EmptyState
          tone="error" icon={AlertTriangle} className="!py-8"
          title="Storage settings could not be loaded"
          description={`${res.error} Nothing is shown here until your saved settings load, so default values cannot be mistaken for them.`}
          action={<Button icon={RefreshCw} onClick={res.reload}>Try again</Button>}
        />
      )}

      {status && values && (
        <form onSubmit={handleSave} noValidate className="space-y-6">
          {res.error && (
            <div role="alert" className="callout callout-warning">
              <AlertTriangle aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <p>Could not refresh storage usage: {res.error} The figures below may be out of date.</p>
                <Button size="sm" icon={RefreshCw} onClick={res.reload} loading={res.refreshing}>Try again</Button>
              </div>
            </div>
          )}

          <fieldset>
            <legend className="label">Storage mode</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {MODES.map(({ id, Icon: ModeIcon, title, text }) => {
                const selected = values.mode === id;
                const unavailable = id === 'cloud' && !cloudReady;
                return (
                  <label key={id} className={`card ${unavailable ? 'cursor-not-allowed opacity-60' : 'card-interactive'} relative block p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${selected ? 'card-selected bg-accent-soft' : ''}`}>
                    <input type="radio" name="storage-mode" value={id} checked={selected} disabled={unavailable} onChange={() => update({ mode: id })} className="sr-only" />
                    <span className="mb-2 flex items-center justify-between">
                      {React.createElement(ModeIcon, { className: 'size-5 text-accent', 'aria-hidden': true })}
                      <span className={`badge ${selected ? 'badge-accent' : 'badge-neutral'}`} aria-hidden="true">{selected ? 'Selected' : 'Select'}</span>
                    </span>
                    <span className="block text-small font-semibold text-fg">{title}</span>
                    <span className="meta-text mt-1 block">{id === 'cloud' && !cloudReady ? 'Unavailable until the backend confirms cloud bucket access.' : text}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {values.mode !== 'cloud' && (
            <Field label="Local bucket" help="Which quota counter new recordings use when Server storage is selected.">
              <select value={values.local_target} onChange={(e) => update({ local_target: e.target.value })} className="select">
                <option value="internal">Internal bucket only</option>
                <option value="sdcard">SD-card bucket only (quota counter, not a physical card)</option>
                <option value="both_failover">Internal first, then the SD-card bucket when the Internal quota is reached</option>
              </select>
            </Field>
          )}

          <p className="text-small text-fg-muted" role="status">With these settings: {summaryFor(values)}</p>

          {status.usage && Object.entries(status.usage).some(([, item]) => ['warning', 'critical', 'full', 'unavailable'].includes(item?.alert?.level)) && (
            <div role="status" aria-live="polite" className="callout callout-warning">
              <AlertTriangle aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold">Storage capacity alert</p>
                {Object.entries(status.usage).filter(([, item]) => ['warning', 'critical', 'full', 'unavailable'].includes(item?.alert?.level)).map(([key, item]) => (
                  <p key={key} className="text-small">{BUCKET_NAME[key]}: {item?.alert?.message || 'Usage unavailable'}</p>
                ))}
                <p className="text-small">New uploads are rejected when their selected bucket cannot fit them. Existing recordings are never removed automatically.</p>
              </div>
              <Button size="sm" icon={RefreshCw} onClick={res.reload} loading={res.refreshing}>Refresh</Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {BUCKETS.map(({ key, label, quotaKey }) => {
              const used = toNum(status.used_mb?.[key]);
              const savedQuota = toNum(status.config[quotaKey]);
              const pct = used !== null && savedQuota ? Math.min(100, Math.max(0, (used / savedQuota) * 100)) : null;
              const changed = values[quotaKey] !== saved[quotaKey];
              return (
                <div key={key} className="min-w-0 space-y-3 rounded-card border border-border bg-surface-sunken p-4">
                  <div>
                    <p className="text-small font-semibold text-fg">{label}</p>
                    <p className="meta-text mt-0.5">{bucketRole(key, values)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-fg-muted">
                      {used === null ? 'Usage unavailable' : `${formatMb(used)} used`} of {savedQuota === null ? 'unavailable' : `${formatMb(savedQuota)} saved quota`}
                    </p>
                    <div
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border"
                      role="progressbar" aria-label={`${label} usage`} aria-valuemin={0} aria-valuemax={100}
                      {...(pct !== null ? { 'aria-valuenow': Math.round(pct), 'aria-valuetext': `${Math.round(pct)}% of the saved quota used` } : { 'aria-valuetext': 'Usage unavailable' })}
                    >
                      {pct !== null && <div className="h-full bg-accent" style={{ width: `${pct}%` }} />}
                    </div>
                    {changed && <p className="meta-text mt-1">Bar uses the saved quota until you save.</p>}
                  </div>
                  <Field label="Quota (MB)" error={submitted ? errors[key] : undefined}>
                    <input ref={quotaRefs[key]} type="number" inputMode="numeric" min="1" step="1" className="input font-mono" value={values[quotaKey]} onChange={(e) => update({ [quotaKey]: e.target.value })} />
                  </Field>
                </div>
              );
            })}
          </div>
          <p className="meta-text">Usage is the total size of recordings counted in each bucket, rounded to the nearest MB.</p>

          <div role="note" className="callout callout-warning">
            <ShieldCheck aria-hidden="true" />
            <p>
              Quotas are enforced before a recording is committed. If the selected bucket cannot fit a new clip, myCam rejects that upload and explains why; it never silently deletes older recordings to make room. Review the retention preview in the Recording Library if you want to remove older clips manually.
            </p>
          </div>

          {saveError && (
            <div role="alert" className="callout callout-danger">
              <AlertTriangle aria-hidden="true" />
              <p>Storage settings were not saved: {saveError} Your changes are still in the form.</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            {dirty && <Button variant="ghost" icon={RotateCcw} onClick={discard} disabled={saving}>Discard changes</Button>}
            <Button type="submit" variant="primary" icon={Save} loading={saving} disabled={!dirty}>{saving ? 'Saving…' : 'Save storage settings'}</Button>
          </div>
        </form>
      )}

      <section className="space-y-4 border-t border-border pt-5" aria-labelledby="upload-ops-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-control border border-border bg-surface-sunken text-accent">
              <Activity className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 id="upload-ops-heading" className="font-semibold text-fg">Upload operations</h3>
              <p className="meta-text mt-1">Tracked upload outcomes and quota reservations for this account.</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={uploadsRes.reload} loading={uploadsRes.refreshing}>Refresh diagnostics</Button>
        </div>

        {uploadsRes.loading && !uploadDiagnostics && <p role="status" className="text-small text-fg-muted">Loading upload diagnostics…</p>}
        {!uploadsRes.loading && uploadsRes.error && (
          <div role="alert" className="callout callout-warning">
            <AlertTriangle aria-hidden="true" />
            <div className="min-w-0 flex-1"><p>Upload diagnostics could not be loaded: {uploadsRes.error}</p></div>
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={uploadsRes.reload}>Try again</Button>
          </div>
        )}
        {uploadDiagnostics && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[{ key: 'processing', label: 'Processing', Icon: LoaderCircle }, { key: 'completed', label: 'Completed', Icon: CheckCircle2 }, { key: 'failed', label: 'Failed / retryable', Icon: XCircle }].map(({ key, label, Icon }) => (
                <div key={key} className="rounded-card border border-border bg-surface-sunken p-4">
                  <div className="flex items-center justify-between gap-2 text-small text-fg-muted"><span>{label}</span>{React.createElement(Icon, { className: 'size-4', 'aria-hidden': true })}</div>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-fg">{Number(uploadDiagnostics.uploads[key] || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>

            {uploadDiagnostics.recent.some((item) => item.is_stale) && (
              <div role="status" className="callout callout-warning">
                <Clock aria-hidden="true" />
                <p>One or more uploads have remained in processing longer than {uploadDiagnostics.stale_processing_after_minutes} minutes. The server recovery worker marks stale requests retryable; refresh diagnostics after a short wait before retrying.</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-small font-semibold text-fg">Quota reservations</h4>
              {uploadDiagnostics.reservations.length === 0 ? (
                <p className="text-small text-fg-muted">No upload reservations have been recorded for this account.</p>
              ) : (
                <div className="overflow-x-auto rounded-card border border-border">
                  <table className="w-full min-w-[520px] text-left text-small">
                    <thead className="bg-surface-sunken text-fg-muted"><tr><th className="px-3 py-2 font-medium">Target</th><th className="px-3 py-2 font-medium">State</th><th className="px-3 py-2 font-medium">Count</th><th className="px-3 py-2 font-medium">Bytes reserved</th><th className="px-3 py-2 font-medium">Stale</th></tr></thead>
                    <tbody>{uploadDiagnostics.reservations.map((item) => <tr key={`${item.storage_target}-${item.status}`} className="border-t border-border"><td className="px-3 py-2">{BUCKET_NAME[item.storage_target] || item.storage_target}</td><td className="px-3 py-2 capitalize">{item.status}</td><td className="px-3 py-2 font-mono tabular-nums">{item.count}</td><td className="px-3 py-2 font-mono tabular-nums">{formatBytes(item.reserved_bytes)}</td><td className="px-3 py-2 font-mono tabular-nums">{item.stale_count}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              <p className="meta-text">Reservations older than 30 minutes are surfaced as stale. They are not manually released from this screen because age alone cannot prove that an upload process is no longer active.</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-small font-semibold text-fg">Recent uploads</h4>
              {uploadDiagnostics.recent.length === 0 ? (
                <p className="text-small text-fg-muted">No upload requests recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {uploadDiagnostics.recent.map((item, index) => (
                    <div key={`${item.recording_id || 'none'}-${item.created_at || index}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-small font-medium text-fg">{item.status === 'completed' && item.recording_id ? `Recording #${item.recording_id}` : item.status === 'failed' ? 'Upload needs retry' : 'Upload request'}</p>
                        <p className="meta-text mt-1">Updated {formatDateTime(item.updated_at)}</p>
                      </div>
                      <span className={`badge ${item.status === 'completed' ? 'badge-success' : item.status === 'failed' || item.is_stale ? 'badge-warning' : 'badge-neutral'}`}>{item.is_stale ? 'Stale processing' : item.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="meta-text">Only requests tracked by the idempotent upload flow appear here. Diagnostics hide idempotency keys, object names, server paths, and raw response payloads. They are informational and do not delete recordings or force-release reservations.</p>
            </div>
            <p className="meta-text">Last checked: {formatDateTime(uploadDiagnostics.generated_at)} · Latest upload activity: {formatDateTime(uploadDiagnostics.uploads.latest_activity)}</p>
          </>
        )}
      </section>
    </section>
  );
};

export default StorageSettings;
