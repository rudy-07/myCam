import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Maximize2, Plus, Radio, SearchX, Trash2, VideoOff, AlertTriangle, ShieldAlert } from 'lucide-react';
import CameraFeed from './CameraFeed';
import CameraModal from './CameraModal';
import { Button, PageHeader, StatusBadge, EmptyState, Modal } from '../ui';
import { CAMERA_STATUS } from '../../lib/cameraStatus';
import { API_BASE } from '../../config';
import { authFetch, readErrorMessage } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

const STATUS_LABEL = {
  [CAMERA_STATUS.LIVE]: 'live',
  [CAMERA_STATUS.CONNECTING]: 'connecting',
  [CAMERA_STATUS.OFFLINE]: 'offline',
  [CAMERA_STATUS.ERROR]: 'connection error',
};

const CameraGrid = ({ user, searchQuery, onNavigate, onClearSearch }) => {
  const { addToast } = useToast();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cameraName, setCameraName] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [cameraToDelete, setCameraToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [statuses, setStatuses] = useState({});

  const loadCameras = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/cameras`);
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const data = await res.json();
      setCameras(Array.isArray(data) ? data : []);
    } catch (error) {
      addToast(error.message || 'Could not load cameras.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  const onFeedStatus = useCallback((cameraId, status, detail) => {
    setStatuses((previous) => {
      const current = previous[cameraId];
      if (current?.status === status && current?.detail === detail) return previous;
      return { ...previous, [cameraId]: { status, detail } };
    });
  }, []);

  const createCamera = async (event) => {
    event.preventDefault();
    const name = cameraName.trim();
    if (name.length < 2) {
      addToast('Enter a camera name with at least 2 characters.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const created = await res.json();
      setCameras((current) => [...current, created]);
      setCameraName('');
      addToast(`Camera "${created.name}" registered. Open its broadcaster link on your stream device.`, 'success', 6000);
    } catch (error) {
      addToast(error.message || 'Could not register camera.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCamera = async () => {
    if (!cameraToDelete) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${API_BASE}/api/cameras/${encodeURIComponent(cameraToDelete.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      setCameras((current) => current.filter((item) => item.id !== cameraToDelete.id));
      if (selectedCamera?.id === cameraToDelete.id) setSelectedCamera(null);
      addToast(`Camera "${cameraToDelete.name}" removed successfully.`, 'success');
      setCameraToDelete(null);
    } catch (error) {
      addToast(error.message || 'Could not remove camera.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const copyBroadcasterLink = async (camera) => {
    const url = new URL(window.location.href);
    url.searchParams.set('cameraId', camera.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      addToast(`Broadcaster link copied for ${camera.name}. Open it on the streaming device, sign in, then click Broadcast.`, 'success', 6000);
    } catch {
      addToast(`Broadcaster URL: ${url.toString()}`, 'info', 8000);
    }
  };

  const query = (searchQuery || '').trim().toLowerCase();
  const filteredCameras = useMemo(
    () => cameras.filter((camera) => !query || camera.name.toLowerCase().includes(query) || camera.id.toLowerCase().includes(query)),
    [cameras, query]
  );

  return (
    <div className="space-y-8">
      {/* Fullscreen Camera Modal */}
      {selectedCamera && (
        <CameraModal
          camera={selectedCamera}
          user={user}
          onClose={() => setSelectedCamera(null)}
          onNavigate={onNavigate}
        >
          <CameraFeed
            key={selectedCamera.id}
            feedKey={selectedCamera.id}
            onStatusChange={(status, detail) => onFeedStatus(selectedCamera.id, status, detail)}
          />
        </CameraModal>
      )}

      {/* Confirmation Modal for Removing Camera */}
      {cameraToDelete && (
        <Modal
          title="Remove Camera"
          size="md"
          closeLabel="Cancel camera removal"
          onClose={() => !deleting && setCameraToDelete(null)}
          footer={
            <div className="flex w-full items-center justify-end gap-2.5">
              <Button
                variant="secondary"
                onClick={() => setCameraToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={confirmDeleteCamera}
                disabled={deleting}
              >
                {deleting ? 'Removing…' : 'Remove Camera'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 p-1">
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3.5 text-small text-fg">
              <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden="true" />
              <p>
                Are you sure you want to remove <strong className="font-semibold text-fg">{cameraToDelete.name}</strong> (<code className="font-mono text-xs">{cameraToDelete.id}</code>)?
              </p>
            </div>
            <p className="text-small text-fg-muted">
              This will remove this camera's registration and associated activity zones and schedules. Past recorded videos and snapshots will remain saved in your storage.
            </p>
          </div>
        </Modal>
      )}

      {/* Page Header */}
      <PageHeader
        eyebrow="Monitoring"
        title="Camera feeds"
        description="Monitor registered camera streams in real-time. Click any camera card to launch the fullscreen theater view with controls."
      />

      {/* 1. Camera Cards Grid (Shown First) */}
      {loading ? (
        <div className="card card-body flex items-center justify-center p-12 text-small text-fg-muted" role="status">
          <div className="flex items-center gap-3">
            <div className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
            Loading registered cameras…
          </div>
        </div>
      ) : filteredCameras.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={query ? 'No cameras match your search' : 'No cameras registered'}
          description={
            query
              ? `Nothing matches "${searchQuery.trim()}".`
              : 'Register a camera below to get started broadcasting and monitoring.'
          }
          action={onClearSearch && query && <Button onClick={onClearSearch}>Clear search</Button>}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCameras.map((camera) => {
            const feed = statuses[camera.id] || { status: CAMERA_STATUS.CONNECTING, detail: 'Waiting for broadcaster status…' };
            const isLive = feed.status === CAMERA_STATUS.LIVE;
            return (
              <article className="card overflow-hidden hover:border-border-strong transition-all duration-200" key={camera.id}>
                {/* Clickable Card Video Thumbnail */}
                <button
                  type="button"
                  onClick={() => setSelectedCamera(camera)}
                  aria-label={`Open ${camera.name}. Status: ${STATUS_LABEL[feed.status] || 'unknown'}.`}
                  className="group relative aspect-video w-full overflow-hidden bg-surface-sunken text-left cursor-pointer"
                >
                  <CameraFeed
                    key={`preview-${camera.id}`}
                    feedKey={camera.id}
                    onStatusChange={(status, detail) => onFeedStatus(camera.id, status, detail)}
                    announce={false}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white">
                    <span className="truncate font-semibold text-xs">{camera.name}</span>
                    <span className="flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[11px] backdrop-blur text-white/90 group-hover:bg-accent group-hover:text-white transition-colors">
                      <Maximize2 className="size-3.5 shrink-0" aria-hidden="true" />
                      Expand
                    </span>
                  </div>
                </button>

                <div className="card-body space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="section-title text-base font-semibold break-words">{camera.name}</h2>
                      <p className="mt-0.5 break-all font-mono text-xs text-fg-subtle">{camera.id}</p>
                    </div>
                    <StatusBadge status={feed.status} pulse={isLive} />
                  </div>

                  <p className="text-small text-fg-muted" role="status">
                    {feed.detail}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Radio}
                      onClick={() => copyBroadcasterLink(camera)}
                      title="Copy link to broadcast from mobile or another device"
                    >
                      Broadcaster link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setCameraToDelete(camera)}
                      aria-label={`Remove ${camera.name}`}
                      className="text-fg-subtle hover:text-danger hover:bg-danger/10"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 2. Register a Camera Card (Placed BELOW Camera Cards) */}
      <section className="card border-dashed border-border-strong/70 bg-surface/50">
        <div className="card-body space-y-4">
          <div>
            <h3 className="section-title text-base">Register a new camera</h3>
            <p className="text-small text-fg-muted mt-0.5">
              Add a camera device to your account to assign it an independent WebRTC stream channel.
            </p>
          </div>

          <form onSubmit={createCamera} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-small font-medium text-fg" htmlFor="camera-name">
              Camera Name
              <input
                id="camera-name"
                value={cameraName}
                onChange={(event) => setCameraName(event.target.value)}
                maxLength={100}
                minLength={2}
                placeholder="e.g. Front Porch, Driveway, Living Room"
                className="field mt-1.5 w-full"
                required
              />
            </label>
            <Button
              type="submit"
              icon={Plus}
              disabled={saving}
              className="sm:min-w-[130px]"
            >
              {saving ? 'Registering…' : 'Add camera'}
            </Button>
          </form>
        </div>
      </section>

      {/* Helpful footnote */}
      <p className="text-xs text-fg-subtle leading-relaxed">
        Each camera uses an independent WebRTC signalling room. A registered camera connects when a device opens its broadcaster link and begins streaming video.
      </p>
    </div>
  );
};

export default CameraGrid;
