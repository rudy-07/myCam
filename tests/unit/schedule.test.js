import { describe, it, expect } from 'vitest';
import {
  DAYS, parseDays, toHHMM, isOvernight, isWindowOpenNow, summarizeDays, validateSchedule,
} from '../../src/lib/schedule';

// 2026-11-02 is a Monday. Local-time constructors keep the tests timezone independent.
const at = (day, hh, mm = 0) => new Date(2026, 10, day, hh, mm, 0); // day 2 = Mon ... 8 = Sun
const MON = 2; const TUE = 3; const SUN = 8;

const sched = (over = {}) => ({ is_active: 1, days_json: JSON.stringify(['Mon']), start_time: '09:00', end_time: '17:00', ...over });

describe('parseDays', () => {
  it('parses the JSON string the database returns, in week order', () =>
    expect(parseDays('["Fri","Mon"]')).toEqual({ days: ['Mon', 'Fri'], valid: true }));
  it('accepts an array', () => expect(parseDays(['Sun', 'Sat'])).toEqual({ days: ['Sat', 'Sun'], valid: true }));
  it('drops unknown day names but stays valid', () => expect(parseDays(['Mon', 'Funday'])).toEqual({ days: ['Mon'], valid: true }));
  it.each([['garbage', 'not json'], ['null', null], ['undefined', undefined], ['object', { a: 1 }], ['number', 7]])(
    'is invalid and empty for %s', (_l, v) => expect(parseDays(v)).toEqual({ days: [], valid: false }));
  it('treats an empty list as valid-but-empty', () => expect(parseDays('[]')).toEqual({ days: [], valid: true }));
});

describe('toHHMM', () => {
  it.each([
    ['22:00:00', '22:00'], ['06:05', '06:05'], ['9:05', '09:05'], ['00:00', '00:00'], ['23:59', '23:59'],
  ])('%s -> %s', (i, o) => expect(toHHMM(i)).toBe(o));
  it.each([['24:00'], ['12:60'], ['abc'], [''], [null], [undefined], ['7']])('%s -> empty string', (i) => expect(toHHMM(i)).toBe(''));
});

describe('isOvernight', () => {
  it('is true when end is earlier than start', () => expect(isOvernight('22:00', '06:00')).toBe(true));
  it('is false for same-day windows and for equal times', () => {
    expect(isOvernight('09:00', '17:00')).toBe(false);
    expect(isOvernight('09:00', '09:00')).toBe(false);
  });
  it('is false when a value is missing', () => expect(isOvernight('', '06:00')).toBe(false));
});

describe('isWindowOpenNow - same-day window', () => {
  it('is open inside the window on a selected day', () => expect(isWindowOpenNow(sched(), at(MON, 12))).toBe(true));
  it('includes both boundaries', () => {
    expect(isWindowOpenNow(sched(), at(MON, 9, 0))).toBe(true);
    expect(isWindowOpenNow(sched(), at(MON, 17, 0))).toBe(true);
  });
  it('is closed just outside the window', () => {
    expect(isWindowOpenNow(sched(), at(MON, 8, 59))).toBe(false);
    expect(isWindowOpenNow(sched(), at(MON, 17, 1))).toBe(false);
  });
  it('is closed on an unselected day', () => expect(isWindowOpenNow(sched(), at(TUE, 12))).toBe(false));
});

describe('isWindowOpenNow - overnight window (Mon 22:00 -> Tue 06:00)', () => {
  const night = sched({ start_time: '22:00', end_time: '06:00' });
  it('is open late on the start day', () => expect(isWindowOpenNow(night, at(MON, 23))).toBe(true));
  it('is open early the next morning (belongs to the previous day)', () => expect(isWindowOpenNow(night, at(TUE, 5))).toBe(true));
  it('is closed during the next day', () => expect(isWindowOpenNow(night, at(TUE, 12))).toBe(false));
  it('is closed early on the start day itself (that morning belongs to Sunday)', () => expect(isWindowOpenNow(night, at(MON, 5))).toBe(false));
  it('wraps Sunday -> Monday correctly', () => {
    const sun = sched({ days_json: '["Sun"]', start_time: '22:00', end_time: '06:00' });
    expect(isWindowOpenNow(sun, at(SUN, 23))).toBe(true);
    expect(isWindowOpenNow(sun, at(MON, 4))).toBe(true);
  });
});

describe('isWindowOpenNow - invalid or disabled schedules', () => {
  it('is closed when disabled (0, false)', () => {
    expect(isWindowOpenNow(sched({ is_active: 0 }), at(MON, 12))).toBe(false);
    expect(isWindowOpenNow(sched({ is_active: false }), at(MON, 12))).toBe(false);
  });
  it('accepts boolean true as enabled', () => expect(isWindowOpenNow(sched({ is_active: true }), at(MON, 12))).toBe(true));
  it.each([
    ['unreadable days', { days_json: 'oops' }], ['no days', { days_json: '[]' }],
    ['equal start/end', { start_time: '09:00', end_time: '09:00' }], ['bad start', { start_time: 'x' }], ['bad end', { end_time: '' }],
  ])('is closed for %s', (_l, over) => expect(isWindowOpenNow(sched(over), at(MON, 12))).toBe(false));
  it('does not throw for null/undefined', () => {
    expect(isWindowOpenNow(null, at(MON, 12))).toBe(false);
    expect(isWindowOpenNow(undefined, at(MON, 12))).toBe(false);
  });
});

describe('summarizeDays', () => {
  it.each([
    [DAYS, 'Every day'], [[], 'No days'], [['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 'Weekdays'],
    [['Sat', 'Sun'], 'Weekends'], [['Mon', 'Wed'], 'Mon, Wed'],
  ])('%j -> %s', (days, text) => expect(summarizeDays(days)).toBe(text));
});

describe('validateSchedule', () => {
  const ok = { name: 'Night', days: ['Mon'], start_time: '22:00', end_time: '06:00' };
  it('accepts a valid overnight schedule', () => expect(validateSchedule(ok)).toEqual({}));
  it('requires a name, days and both times', () => {
    const e = validateSchedule({ name: ' ', days: [], start_time: '', end_time: '' });
    expect(Object.keys(e).sort()).toEqual(['days', 'end_time', 'name', 'start_time']);
  });
  it('rejects a name over 60 characters', () => expect(validateSchedule({ ...ok, name: 'n'.repeat(61) }).name).toBeTruthy());
  it('rejects identical start and end', () => expect(validateSchedule({ ...ok, end_time: '22:00' }).end_time).toMatch(/differ/));
  it('accepts HH:MM:SS input', () => expect(validateSchedule({ ...ok, start_time: '22:00:00', end_time: '06:00:00' })).toEqual({}));
});
