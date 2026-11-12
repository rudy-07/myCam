import { describe, it, expect } from 'vitest';
import { usableZones, evaluateMotion, motionAlertMessage } from '../../src/lib/motionAlerts';

const square = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const left = { id: 1, coordinates_json: square(0, 0, 0.4, 1) };
const box = (cx, cy) => ({ x: cx - 0.05, y: cy - 0.05, width: 0.1, height: 0.1 });

describe('motion alert policy (TESTING_GUIDE Tests 7 and 8)', () => {
  it('with no zones, motion anywhere raises an alert', () => {
    expect(evaluateMotion(box(0.9, 0.5), [])).toEqual({ hasZones: false, inZone: false, shouldAlert: true });
    expect(evaluateMotion(box(0.9, 0.5), undefined).shouldAlert).toBe(true);
  });
  it('with a zone, only motion whose centre is inside raises an alert', () => {
    expect(evaluateMotion(box(0.2, 0.5), [left])).toMatchObject({ hasZones: true, inZone: true, shouldAlert: true });
    expect(evaluateMotion(box(0.8, 0.5), [left])).toMatchObject({ hasZones: true, inZone: false, shouldAlert: false });
  });
  it('accepts coordinates as the JSON string some databases return', () => {
    const zone = { id: 2, coordinates_json: JSON.stringify(square(0, 0, 0.4, 1)) };
    expect(evaluateMotion(box(0.2, 0.5), [zone]).shouldAlert).toBe(true);
    expect(evaluateMotion(box(0.8, 0.5), [zone]).shouldAlert).toBe(false);
  });
  it('multiple zones: inside any one is enough', () => {
    const right = { id: 3, coordinates_json: square(0.6, 0, 1, 1) };
    expect(evaluateMotion(box(0.8, 0.5), [left, right]).shouldAlert).toBe(true);
    expect(evaluateMotion(box(0.5, 0.5), [left, right]).shouldAlert).toBe(false);
  });
});

describe('corrupt zone coordinates (regression: one bad zone used to match all motion)', () => {
  const corruptions = [['invalid JSON', 'not json'], ['null', null], ['too few points', [{ x: 0, y: 0 }, { x: 1, y: 1 }]], ['non-numeric', [{ x: 'a', y: 'b' }, { x: 0, y: 0 }, { x: 1, y: 1 }]], ['an object', { x: 1 }]];
  it.each(corruptions)('ignores a zone with %s', (_l, bad) => expect(usableZones([{ id: 9, coordinates_json: bad }, left])).toEqual([left]));
  it.each(corruptions)('a %s zone does not disable filtering by the valid zone', (_l, bad) => {
    const zones = [{ id: 9, coordinates_json: bad }, left];
    expect(evaluateMotion(box(0.8, 0.5), zones).shouldAlert).toBe(false);
    expect(evaluateMotion(box(0.2, 0.5), zones).shouldAlert).toBe(true);
  });
  it('when every zone is unreadable the camera behaves as if it had no zones', () => {
    expect(evaluateMotion(box(0.8, 0.5), [{ id: 1, coordinates_json: 'x' }])).toEqual({ hasZones: false, inZone: false, shouldAlert: true });
  });
  it('ignores non-array input and null entries', () => {
    expect(usableZones(null)).toEqual([]);
    expect(usableZones([null, undefined, left])).toEqual([left]);
  });
});

describe('motionAlertMessage', () => {
  it('only mentions an activity zone when zones exist', () => {
    expect(motionAlertMessage('Front Door', false)).toBe('Motion detected on Front Door');
    expect(motionAlertMessage('Front Door', true)).toBe('Motion detected inside an activity zone on Front Door');
  });
});
