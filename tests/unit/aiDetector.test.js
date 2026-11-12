import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isPointInPolygon, isBoxIntersectingZone, analyzeFrameMotion, resetMotionState } from '../../src/utils/aiDetector';

const W = 160; const H = 90;
const blank = () => ({ data: new Uint8ClampedArray(W * H * 4), width: W, height: H });
// Paint a red-channel block (x0..x1, y0..y1 inclusive) with value v.
const frameWith = (x0, y0, x1, y1, v) => {
  const f = blank();
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) f.data[(y * W + x) * 4] = v;
  return f;
};
const video = { readyState: 4, videoWidth: 640 };
/** Feed the detector a sequence of frames through a canvas stand-in (the pixel maths under test is real). */
const feed = (frames) => {
  let i = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage() {}, getImageData: () => frames[Math.min(i++, frames.length - 1)] }));
};

describe('isPointInPolygon', () => {
  const square = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }];
  it('detects inside and outside', () => {
    expect(isPointInPolygon({ x: 0.5, y: 0.5 }, square)).toBe(true);
    expect(isPointInPolygon({ x: 0.1, y: 0.5 }, square)).toBe(false);
    expect(isPointInPolygon({ x: 0.5, y: 0.9 }, square)).toBe(false);
  });
  it('handles a concave (L-shaped) polygon', () => {
    const L = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    expect(isPointInPolygon({ x: 0.75, y: 0.25 }, L)).toBe(false); // the notch
    expect(isPointInPolygon({ x: 0.25, y: 0.25 }, L)).toBe(true);
    expect(isPointInPolygon({ x: 0.75, y: 0.75 }, L)).toBe(true);
  });
  it('accepts the polygon as a JSON string', () => expect(isPointInPolygon({ x: 0.5, y: 0.5 }, JSON.stringify(square))).toBe(true));
  it('DOCUMENTED: an unusable polygon is treated as "matches" (fail-open); callers filter these out with usableZones()', () => {
    expect(isPointInPolygon({ x: 0.5, y: 0.5 }, 'not json')).toBe(true);
    expect(isPointInPolygon({ x: 0.5, y: 0.5 }, [{ x: 0, y: 0 }])).toBe(true);
    expect(isPointInPolygon({ x: 0.5, y: 0.5 }, null)).toBe(true);
  });
});

describe('isBoxIntersectingZone uses the box centre', () => {
  const zone = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }];
  it('centre inside -> true even if the box overhangs', () => expect(isBoxIntersectingZone({ x: 0.3, y: 0.4, width: 0.3, height: 0.1 }, zone)).toBe(true)); // centre x=0.45
  it('centre outside -> false even if the box overlaps', () => expect(isBoxIntersectingZone({ x: 0.4, y: 0.4, width: 0.3, height: 0.1 }, zone)).toBe(false)); // centre x=0.55
  it('no coordinates -> true (no zone to filter by)', () => expect(isBoxIntersectingZone({ x: 0, y: 0, width: 1, height: 1 }, null)).toBe(true));
});

describe('analyzeFrameMotion (real frame-difference maths on controlled pixels)', () => {
  beforeEach(() => { resetMotionState(); });

  it('returns nothing when the video is not ready', () => {
    expect(analyzeFrameMotion(null)).toEqual([]);
    expect(analyzeFrameMotion({ readyState: 1, videoWidth: 640 })).toEqual([]);
    expect(analyzeFrameMotion({ readyState: 4, videoWidth: 0 })).toEqual([]);
  });
  it('needs a baseline frame: the first call never reports motion', () => {
    feed([frameWith(10, 10, 39, 29, 255)]);
    expect(analyzeFrameMotion(video)).toEqual([]);
  });
  it('reports a normalised box for a changed block, in grid cell 0-0', () => {
    feed([blank(), frameWith(10, 10, 39, 29, 255)]);
    analyzeFrameMotion(video);
    const [region] = analyzeFrameMotion(video);
    expect(region.id).toBe('grid-0-0');
    expect(region.box.x).toBeCloseTo(10 / W, 6);
    expect(region.box.y).toBeCloseTo(10 / H, 6);
    expect(region.box.width).toBeCloseTo(28 / W, 6); // sampled x 10..38
    expect(region.box.height).toBeCloseTo(18 / H > 0.18 ? 18 / H : 0.18, 6);
  });
  it('reports nothing for identical frames', () => {
    feed([frameWith(10, 10, 39, 29, 200), frameWith(10, 10, 39, 29, 200)]);
    analyzeFrameMotion(video);
    expect(analyzeFrameMotion(video)).toEqual([]);
  });
  it.each([
    // [pixel difference, sensitivity, detected?]  thresholds: s1=90, s2=65, s3=42 (strictly greater)
    [50, 3, true], [50, 2, false], [50, 1, false],
    [80, 3, true], [80, 2, true], [80, 1, false],
    [120, 1, true], [42, 3, false], [43, 3, true], [65, 2, false], [66, 2, true], [90, 1, false], [91, 1, true],
  ])('a difference of %i at sensitivity %i -> detected: %s', (diff, sensitivity, detected) => {
    feed([blank(), frameWith(10, 10, 39, 29, diff)]);
    analyzeFrameMotion(video, { sensitivity });
    expect(analyzeFrameMotion(video, { sensitivity }).length > 0).toBe(detected);
  });
  it('ignores a change too small to count (4 sampled pixels)', () => {
    feed([blank(), frameWith(10, 10, 13, 13, 255)]);
    analyzeFrameMotion(video, { sensitivity: 3 });
    expect(analyzeFrameMotion(video, { sensitivity: 3 })).toEqual([]);
  });
  it('clamps invalid sensitivity to the default (2)', () => {
    feed([blank(), frameWith(10, 10, 39, 29, 66)]);
    analyzeFrameMotion(video, { sensitivity: 'abc' });
    expect(analyzeFrameMotion(video, { sensitivity: 'abc' }).length).toBe(1); // 66 > 65 only at sensitivity 2
  });
  it('splits motion across the 2x2 grid', () => {
    feed([blank(), (() => { const a = frameWith(10, 10, 39, 29, 255); const b = frameWith(100, 55, 139, 79, 255); b.data.forEach((v, i) => { if (v) a.data[i] = v; }); return a; })()]);
    analyzeFrameMotion(video);
    expect(analyzeFrameMotion(video).map((r) => r.id).sort()).toEqual(['grid-0-0', 'grid-1-1']);
  });
  it('resetMotionState drops the baseline', () => {
    feed([blank(), frameWith(10, 10, 39, 29, 255), frameWith(10, 10, 39, 29, 255)]);
    analyzeFrameMotion(video); resetMotionState();
    expect(analyzeFrameMotion(video)).toEqual([]);
  });
  it('smooths a region towards its previous position (alpha 0.4) instead of jumping', () => {
    const base = frameWith(10, 10, 39, 29, 255);
    const moved = frameWith(10, 10, 39, 29, 255);
    for (let y = 10; y <= 29; y += 1) for (let x = 60; x <= 75; x += 1) moved.data[(y * W + x) * 4] = 255; // only the new block differs from `base`
    feed([blank(), base, moved]);
    analyzeFrameMotion(video);
    const first = analyzeFrameMotion(video)[0].box.x;       // raw 10/160
    const second = analyzeFrameMotion(video)[0].box.x;      // raw 60/160, blended
    expect(first).toBeCloseTo(10 / W, 6);
    expect(second).toBeCloseTo(0.4 * (60 / W) + 0.6 * first, 6);
  });
});
