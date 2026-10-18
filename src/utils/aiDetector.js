/**
 * Motion detection utility for myCam.
 *
 * IMPORTANT: this is simple frame-differencing. It compares two consecutive
 * low-resolution frames, finds regions where pixels changed, and draws a box
 * around them. It does NOT use a trained model and cannot tell what moved
 * (person, vehicle, animal, shadow, lighting change...). Do not present its
 * output as object recognition.
 *
 * (The filename is kept for import compatibility.)
 */

// Point-in-Polygon Ray-Casting Algorithm for Activity Zone Intersection
export const isPointInPolygon = (point, polygon) => {
    let rawPolygon = polygon;
    if (typeof rawPolygon === 'string') {
        try { rawPolygon = JSON.parse(rawPolygon); } catch { return true; }
    }
    if (!Array.isArray(rawPolygon) || rawPolygon.length < 3) return true;

    let inside = false;
    for (let i = 0, j = rawPolygon.length - 1; i < rawPolygon.length; j = i++) {
        const xi = rawPolygon[i].x, yi = rawPolygon[i].y;
        const xj = rawPolygon[j].x, yj = rawPolygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

// Check if Bounding Box Centroid intersects any Activity Zone
export const isBoxIntersectingZone = (box, zoneCoordinates) => {
    if (!zoneCoordinates) return true;
    let coords = zoneCoordinates;
    if (typeof coords === 'string') {
        try { coords = JSON.parse(coords); } catch { return true; }
    }
    if (!Array.isArray(coords) || coords.length < 3) return true;

    const centroid = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
    };
    return isPointInPolygon(centroid, coords);
};

// Previous-frame cache and smoothed boxes (module-level, one analysed feed at a time)
let lastFrameData = null;
let smoothedBoxes = [];

export const resetMotionState = () => {
    lastFrameData = null;
    smoothedBoxes = [];
};

/**
 * Compare the current video frame against the previous one.
 * Returns an array of { id, box: {x, y, width, height} } with normalised (0-1)
 * coordinates, one per changed region of a 2x2 grid. No labels, categories or
 * confidence values are produced because none can be derived from frame differences.
 */
export const analyzeFrameMotion = (videoElement, options = {}) => {
    // Sensitivity is explicit and bounded: higher sensitivity lowers pixel and
    // region thresholds. This remains frame-difference motion, not AI detection.
    const sensitivity = Math.min(3, Math.max(1, Number(options.sensitivity) || 2));
    const pixelThreshold = sensitivity === 3 ? 42 : sensitivity === 2 ? 65 : 90;
    const minimumChangedPixels = sensitivity === 3 ? 8 : sensitivity === 2 ? 15 : 25;
    if (!videoElement || videoElement.readyState < 2 || !videoElement.videoWidth) {
        return [];
    }

    const width = 160;
    const height = 90;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(videoElement, 0, 0, width, height);

    const frameData = ctx.getImageData(0, 0, width, height);
    const rawRegions = [];

    if (lastFrameData) {
        const data1 = lastFrameData.data;
        const data2 = frameData.data;

        const gridCols = 2;
        const gridRows = 2;
        const cellW = width / gridCols;
        const cellH = height / gridRows;

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                let minX = (c + 1) * cellW, minY = (r + 1) * cellH, maxX = c * cellW, maxY = r * cellH;
                let motionPixels = 0;

                const startY = Math.floor(r * cellH);
                const endY = Math.floor((r + 1) * cellH);
                const startX = Math.floor(c * cellW);
                const endX = Math.floor((c + 1) * cellW);

                for (let y = startY; y < endY; y += 2) {
                    for (let x = startX; x < endX; x += 2) {
                        const idx = (y * width + x) * 4;
                        const diff = Math.abs(data1[idx] - data2[idx]) +
                                     Math.abs(data1[idx+1] - data2[idx+1]) +
                                     Math.abs(data1[idx+2] - data2[idx+2]);

                        if (diff > pixelThreshold) {
                            motionPixels++;
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }

                if (motionPixels > minimumChangedPixels && maxX > minX && maxY > minY) {
                    rawRegions.push({
                        id: `grid-${r}-${c}`,
                        box: {
                            x: minX / width,
                            y: minY / height,
                            width: Math.max(0.12, (maxX - minX) / width),
                            height: Math.max(0.18, (maxY - minY) / height)
                        }
                    });
                }
            }
        }
    }

    lastFrameData = frameData;

    // Smooth each region against its previous position (matched by grid cell id)
    const alpha = 0.4;
    const prevById = new Map(smoothedBoxes.map(d => [d.id, d]));
    smoothedBoxes = rawRegions.map((det) => {
        const prev = prevById.get(det.id);
        if (!prev) return det;
        return {
            ...det,
            box: {
                x: prev.box.x * (1 - alpha) + det.box.x * alpha,
                y: prev.box.y * (1 - alpha) + det.box.y * alpha,
                width: prev.box.width * (1 - alpha) + det.box.width * alpha,
                height: prev.box.height * (1 - alpha) + det.box.height * alpha,
            }
        };
    });

    return smoothedBoxes;
};
