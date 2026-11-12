import { describe, it, expect } from 'vitest';
import {
  parseCoordinates, polygonArea, containRect, toNormalized, fromNormalized, validateDraft, MIN_POINTS, MAX_NAME_LENGTH,
} from '../../src/lib/zones';

const square = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }];

describe('parseCoordinates', () => {
  it('accepts an array of points', () => expect(parseCoordinates(square)).toEqual(square));
  it('accepts the JSON string the database returns', () => expect(parseCoordinates(JSON.stringify(square))).toEqual(square));
  it('coerces numeric strings', () => expect(parseCoordinates([{ x: '0.1', y: '0.9' }])).toEqual([{ x: 0.1, y: 0.9 }]));
  it.each([
    ['invalid JSON', '{not json'],
    ['a non-array', { x: 1, y: 2 }],
    ['null', null],
    ['undefined', undefined],
    ['a number', 5],
  ])('returns null for %s', (_label, input) => expect(parseCoordinates(input)).toBeNull());
  it('returns null when any point is not finite', () => {
    expect(parseCoordinates([{ x: 0.1, y: 0.1 }, { x: 'abc', y: 0.2 }])).toBeNull();
    expect(parseCoordinates([{ x: 0.1, y: 0.1 }, null])).toBeNull();
    expect(parseCoordinates([{ x: Infinity, y: 0 }])).toBeNull();
  });
  it('returns an empty array for an empty list (not null)', () => expect(parseCoordinates([])).toEqual([]));
});

describe('polygonArea', () => {
  it('computes the area of a rectangle', () => expect(polygonArea(square)).toBeCloseTo(0.36, 6));
  it('computes a unit triangle', () => expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBeCloseTo(0.5, 6));
  it('is independent of winding order', () => expect(polygonArea([...square].reverse())).toBeCloseTo(polygonArea(square), 6));
  it('is zero for collinear points', () => expect(polygonArea([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }])).toBe(0));
  it('is zero for no points', () => expect(polygonArea([])).toBe(0));
});

describe('containRect', () => {
  it('fills the box when aspect ratios match', () => expect(containRect(1600, 900, 1280, 720)).toEqual({ x: 0, y: 0, w: 1600, h: 900 }));
  it('letterboxes portrait video inside a landscape box', () => {
    const r = containRect(800, 450, 9, 16);
    expect(r.h).toBeCloseTo(450, 6);
    expect(r.w).toBeCloseTo(253.125, 3);
    expect(r.x).toBeCloseTo((800 - 253.125) / 2, 3);
    expect(r.y).toBeCloseTo(0, 6);
  });
  it('pillarboxes wide video inside a tall box', () => {
    const r = containRect(400, 800, 16, 9);
    expect(r.w).toBeCloseTo(400, 6);
    expect(r.h).toBeCloseTo(225, 6);
    expect(r.y).toBeCloseTo((800 - 225) / 2, 6);
  });
  it.each([[0, 450, 16, 9], [800, 0, 16, 9], [800, 450, 0, 9], [800, 450, 16, 0], [NaN, 1, 1, 1], [-1, 1, 1, 1]])(
    'returns null for unusable size (%s,%s,%s,%s)', (...args) => expect(containRect(...args)).toBeNull());
});

describe('toNormalized / fromNormalized', () => {
  const rect = { x: 100, y: 50, w: 400, h: 300 };
  it('maps the frame corners to 0 and 1', () => {
    expect(toNormalized(100, 50, rect)).toEqual({ x: 0, y: 0 });
    expect(toNormalized(500, 350, rect)).toEqual({ x: 1, y: 1 });
  });
  it('maps the centre to 0.5', () => expect(toNormalized(300, 200, rect)).toEqual({ x: 0.5, y: 0.5 }));
  it('rounds to 4 decimals', () => expect(toNormalized(100 + 400 / 3, 50, rect).x).toBe(0.3333));
  it('rejects points outside the frame', () => {
    expect(toNormalized(99, 100, rect)).toBeNull();
    expect(toNormalized(300, 351, rect)).toBeNull();
  });
  it('clamps points inside the edge tolerance onto the edge', () => {
    expect(toNormalized(95, 200, rect, 12)).toEqual({ x: 0, y: 0.5 });
    expect(toNormalized(505, 355, rect, 12)).toEqual({ x: 1, y: 1 });
  });
  it('rejects points beyond the tolerance', () => expect(toNormalized(80, 200, rect, 12)).toBeNull());
  it('returns null without a rect', () => expect(toNormalized(1, 1, null)).toBeNull());
  it('round-trips through fromNormalized', () => {
    const p = toNormalized(250, 125, rect);
    const back = fromNormalized(p, rect);
    expect(back.x).toBeCloseTo(250, 1);
    expect(back.y).toBeCloseTo(125, 1);
  });
});

describe('validateDraft', () => {
  it('accepts a named polygon with enough area', () => expect(validateDraft({ name: 'Front door', points: square })).toEqual({}));
  it('requires a name (whitespace is empty)', () => expect(validateDraft({ name: '   ', points: square }).name).toMatch(/name/i));
  it('rejects names over the limit but accepts exactly the limit', () => {
    expect(validateDraft({ name: 'x'.repeat(MAX_NAME_LENGTH + 1), points: square }).name).toBeTruthy();
    expect(validateDraft({ name: 'x'.repeat(MAX_NAME_LENGTH), points: square })).toEqual({});
  });
  it('requires at least MIN_POINTS corners and says how many exist', () => {
    const errors = validateDraft({ name: 'a', points: square.slice(0, MIN_POINTS - 1) });
    expect(errors.points).toContain(`${MIN_POINTS - 1} so far`);
  });
  it('rejects a polygon that encloses almost no area', () => {
    const sliver = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.1005 }];
    expect(validateDraft({ name: 'a', points: sliver }).points).toMatch(/almost no area/);
  });
  it('tolerates a missing name', () => expect(validateDraft({ points: square }).name).toBeTruthy());
});
