import { describe, it, expect } from 'vitest';
import { cameraLabel, BROADCASTER_ID, BROADCASTER_LABEL } from '../../src/lib/cameras';
import { summarizeStatuses, CAMERA_STATUS } from '../../src/lib/cameraStatus';
import { buildCameraNameMap, cameraLabel as mapLabel, describeCamera, describeRecording, describeSchedule, describeZone } from '../../src/lib/searchResults';

describe('cameraLabel', () => {
  it('names the broadcaster and passes other ids through', () => {
    expect(cameraLabel(BROADCASTER_ID)).toBe(BROADCASTER_LABEL);
    expect(cameraLabel('garage')).toBe('garage');
    expect(cameraLabel('')).toBe('Unknown camera');
    expect(cameraLabel(undefined)).toBe('Unknown camera');
  });
});

describe('summarizeStatuses', () => {
  const S = CAMERA_STATUS;
  it('handles no cameras', () => expect(summarizeStatuses([]).text).toBe('No cameras to report on'));
  it('all live (singular and plural)', () => {
    expect(summarizeStatuses([S.LIVE]).text).toBe('1 of 1 camera live');
    expect(summarizeStatuses([S.LIVE, S.LIVE]).text).toBe('2 of 2 cameras live');
  });
  it('mixed states', () => {
    const r = summarizeStatuses([S.LIVE, S.CONNECTING, S.OFFLINE, S.ERROR]);
    expect(r.counts).toEqual({ live: 1, connecting: 1, offline: 1, error: 1 });
    expect(r.text).toBe('1 live · 1 connecting · 1 offline · 1 with errors');
  });
  it('ignores unknown states in the counts', () => expect(summarizeStatuses(['weird', S.LIVE]).counts.live).toBe(1));
});

describe('searchResults (real backend row shapes)', () => {
  const map = buildCameraNameMap([{ id: 'a', name: 'Front' }, { id: 2 }, null, { name: 'no id' }]);
  it('builds a name map tolerant of bad rows and non-arrays', () => {
    expect(map.get('a')).toBe('Front'); expect(map.get('2')).toBe('Camera 2'); expect(buildCameraNameMap(null).size).toBe(0);
  });
  it('mapLabel resolves, falls back to the id, and flags missing ids', () => {
    expect(mapLabel(map, 'a')).toBe('Front'); expect(mapLabel(map, 'zzz')).toBe('zzz'); expect(mapLabel(map, null)).toBe('Unknown camera'); expect(mapLabel(map, '')).toBe('Unknown camera');
  });
  it('describeCamera: enabled state only, never online/offline', () => {
    expect(describeCamera({ id: 'a', name: 'Front', is_enabled: 1, source_label: 'Phone' })).toEqual({ title: 'Front', subtitle: 'Camera ID #a · Phone', badge: 'Enabled' });
    expect(describeCamera({ id: 'b', is_enabled: 0 }).badge).toBe('Disabled');
    expect(describeCamera({ id: 'c' }).badge).toBe('Enabled'); // column absent: not claimed disabled
    expect(describeCamera({ id: 'd', is_enabled: false }).badge).toBe('Disabled');
  });
  it('describeRecording: filename, camera name, MM:SS badge, fallbacks', () => {
    const r = describeRecording({ id: 1, filename: 'a.webm', camera_id: 'a', duration: '02:15', created_at: '2026-03-04T10:00:00Z' }, map);
    expect(r).toMatchObject({ title: 'a.webm', camera: 'Front', badge: '02:15' });
    const bare = describeRecording({ id: 9 }, map);
    expect(bare).toMatchObject({ title: 'Recording 9', badge: 'Recording', camera: 'Unknown camera' });
    expect(bare.subtitle).toContain('Archived Video');
    expect(describeRecording({ id: 1, duration: '00:00', created_at: 'bad' }, map).badge).toBe('00:00'); // a real zero-length value is shown, not hidden
    expect(describeRecording({ id: 1, duration: '', created_at: 'bad' }, map).badge).toBe('Recording');
    expect(describeRecording({ id: 1, duration: null }, map).badge).toBe('Recording');
  });
  it('describeSchedule: window, days, state; copes with bad data', () => {
    const s = describeSchedule({ id: 1, name: 'N', camera_id: 'a', days_json: '["Sat","Sun"]', start_time: '22:00:00', end_time: '06:00:00', is_active: 1 }, map);
    expect(s).toMatchObject({ title: 'N', dayText: 'Weekends', camera: 'Front', badge: 'Active' });
    expect(s.subtitle).toBe('Schedules · 22:00 - 06:00 (Weekends)');
    const bad = describeSchedule({ id: 2, days_json: 'x', start_time: null, end_time: 'q', is_active: 0 }, map);
    expect(bad).toMatchObject({ title: 'Schedule 2', dayText: 'Days unavailable', badge: 'Disabled' });
    expect(bad.subtitle).toContain('Time unavailable');
  });
  it('describeZone: counts corners from array or string, never invents', () => {
    expect(describeZone({ id: 1, name: 'Z', camera_id: 'a', coordinates_json: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }, map)).toMatchObject({ badge: '3 points', camera: 'Front', subtitle: 'Activity Zone · Front' });
    expect(describeZone({ id: 2, coordinates_json: 'bad' }, map)).toMatchObject({ title: 'Zone 2', badge: 'Zone' });
  });
});
