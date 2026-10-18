/**
 * Activity-zone geometry. Zones are stored as an array of {x, y} points that are
 * NORMALISED (0-1) to the video FRAME, which is the space the motion detector
 * works in. The frame is not always the same shape as the on-screen box (the feed is
 * shown with object-fit: contain), so clicks are mapped through containRect().
 */
export const MIN_POINTS = 3;
export const MAX_NAME_LENGTH = 60;
const MIN_AREA = 0.002; // 0.2% of the frame: rejects collinear / near-zero polygons

/** Parse stored coordinates safely. Returns an array of finite {x, y}, or null if unreadable. */
export const parseCoordinates = (raw) => {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!Array.isArray(value)) return null;
  const points = value.map((p) => ({ x: Number(p?.x), y: Number(p?.y) }));
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  return points;
};

export const polygonArea = (points) => {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j].x * points[i].y - points[i].x * points[j].y;
  }
  return Math.abs(sum) / 2;
};

/** The rectangle (in box pixels) that content of contentW x contentH occupies when contained in boxW x boxH. */
export const containRect = (boxW, boxH, contentW, contentH) => {
  if (!(boxW > 0 && boxH > 0 && contentW > 0 && contentH > 0)) return null;
  const scale = Math.min(boxW / contentW, boxH / contentH);
  const w = contentW * scale;
  const h = contentH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
};

const round4 = (n) => Math.round(n * 10000) / 10000;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * Box pixel -> normalised frame point. Points up to `tolerance` px outside the frame are
 * clamped onto its edge (so edges are reachable by touch); anything further is rejected (null).
 */
export const toNormalized = (px, py, rect, tolerance = 0) => {
  if (!rect) return null;
  if (px < rect.x - tolerance || px > rect.x + rect.w + tolerance) return null;
  if (py < rect.y - tolerance || py > rect.y + rect.h + tolerance) return null;
  return { x: round4(clamp01((px - rect.x) / rect.w)), y: round4(clamp01((py - rect.y) / rect.h)) };
};

export const fromNormalized = (point, rect) => ({ x: rect.x + point.x * rect.w, y: rect.y + point.y * rect.h });

/** Returns an object of field -> message. Empty object = valid. */
export const validateDraft = ({ name, points }) => {
  const errors = {};
  const trimmed = (name || '').trim();
  if (!trimmed) errors.name = 'Give the zone a name.';
  else if (trimmed.length > MAX_NAME_LENGTH) errors.name = `Use ${MAX_NAME_LENGTH} characters or fewer.`;
  if (points.length < MIN_POINTS) errors.points = `Place at least ${MIN_POINTS} corners (${points.length} so far).`;
  else if (polygonArea(points) < MIN_AREA) errors.points = 'The corners enclose almost no area. Spread them out.';
  return errors;
};
