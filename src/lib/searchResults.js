// Pure helpers that turn REAL backend rows (server/routes.cjs) into palette result text.
// The backend returns snake_case rows for cameras, recordings, schedules and zones.
import { parseDays, toHHMM, summarizeDays } from './schedule';
import { parseCoordinates } from './zones';
import { formatDuration, parseTimestamp } from './recordingMedia';

export const cameraName = (cam) => (cam && (cam.name || `Camera ${cam.id}`)) || 'Camera';

/** Map camera id -> display name so recordings/zones/schedules can show the camera, not a bare id. */
export function buildCameraNameMap(cameras) {
  const map = new Map();
  (Array.isArray(cameras) ? cameras : []).forEach((c) => { if (c && c.id != null) map.set(String(c.id), cameraName(c)); });
  return map;
}

export const cameraLabel = (map, id) => (id == null || id === '' ? 'Unknown camera' : map.get(String(id)) || String(id));

/** The API has no "online" flag, so only the stored enabled state is reported. */
export function describeCamera(cam) {
  const enabled = cam.is_enabled === undefined || cam.is_enabled === null ? true : Number(cam.is_enabled) === 1 || cam.is_enabled === true;
  const source = cam.source_label ? ` · ${cam.source_label}` : '';
  return { title: cameraName(cam), subtitle: `Camera ID #${cam.id}${source}`, badge: enabled ? 'Enabled' : 'Disabled' };
}

export function describeRecording(rec, nameMap) {
  const title = rec.filename || `Recording ${rec.id}`;
  const camera = cameraLabel(nameMap, rec.camera_id);
  const ts = parseTimestamp(rec.created_at);
  return {
    title,
    camera,
    subtitle: `${camera} · ${ts === null ? 'Archived Video' : new Date(ts).toLocaleDateString()}`,
    badge: formatDuration(rec.duration) || 'Recording',
  };
}

export function describeSchedule(sch, nameMap) {
  const { days, valid } = parseDays(sch.days_json);
  const dayText = valid && days.length ? summarizeDays(days) : 'Days unavailable';
  const start = toHHMM(sch.start_time);
  const end = toHHMM(sch.end_time);
  const window = start && end ? `${start} - ${end}` : 'Time unavailable';
  const active = sch.is_active === true || Number(sch.is_active) === 1;
  return {
    title: sch.name || `Schedule ${sch.id}`,
    dayText,
    camera: cameraLabel(nameMap, sch.camera_id),
    subtitle: `Schedules · ${window} (${dayText})`,
    badge: active ? 'Active' : 'Disabled',
  };
}

export function describeZone(zone, nameMap) {
  const points = parseCoordinates(zone.coordinates_json); // real column name: activity_zones.coordinates_json
  const camera = cameraLabel(nameMap, zone.camera_id);
  return {
    title: zone.name || `Zone ${zone.id}`,
    camera,
    subtitle: `Activity Zone · ${camera}`,
    badge: points ? `${points.length} points` : 'Zone',
  };
}
