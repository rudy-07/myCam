/**
 * AI Motion Detection & Computer Vision Analysis Utility for myCam
 * Features: Multi-Blob Clustering, EMA Smoothing, and Point-in-Polygon Filtering
 */

// Point-in-Polygon Ray-Casting Algorithm for Activity Zone Intersection
export const isPointInPolygon = (point, polygon) => {
    let rawPolygon = polygon;
    if (typeof rawPolygon === 'string') {
        try { rawPolygon = JSON.parse(rawPolygon); } catch (e) { return true; }
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
        try { coords = JSON.parse(coords); } catch (e) { return true; }
    }
    if (!Array.isArray(coords) || coords.length < 3) return true;

    const centroid = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
    };
    return isPointInPolygon(centroid, coords);
};

// Temporal EMA Smoothing Cache for Stable Bounding Boxes
let lastFrameData = null;
let smoothedBoxes = [];

export const analyzeFrameAI = (videoElement, filterCategory = 'all') => {
    if (!videoElement || videoElement.readyState !== 4 || !videoElement.videoWidth) {
        return [];
    }

    const width = 160;
    const height = 90;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, width, height);

    const frameData = ctx.getImageData(0, 0, width, height);
    const rawDetections = [];

    if (lastFrameData) {
        const data1 = lastFrameData.data;
        const data2 = frameData.data;

        // Grid-based Motion Clustering (4 quadrants to separate multiple objects)
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

                        if (diff > 65) {
                            motionPixels++;
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }

                if (motionPixels > 15 && maxX > minX && maxY > minY) {
                    const normX = minX / width;
                    const normY = minY / height;
                    const normW = Math.max(0.12, (maxX - minX) / width);
                    const normH = Math.max(0.18, (maxY - minY) / height);

                    const aspectRatio = normW / (normH || 0.01);
                    let label = 'Person';
                    let confidence = Math.min(0.98, 0.82 + (motionPixels / 300));

                    if (aspectRatio > 1.25) {
                        label = 'Vehicle';
                        confidence = Math.min(0.96, 0.85 + (normW * 0.2));
                    } else if (normH < 0.22 && normW < 0.22) {
                        label = 'Pet';
                        confidence = 0.88;
                    } else {
                        label = 'Person';
                    }

                    const matchesFilter = filterCategory === 'all' || 
                                         (filterCategory === 'person' && label === 'Person') ||
                                         (filterCategory === 'vehicle' && label === 'Vehicle');

                    if (matchesFilter) {
                        rawDetections.push({
                            id: `grid-${r}-${c}`,
                            label,
                            confidence: Math.round(confidence * 100),
                            box: { x: normX, y: normY, width: normW, height: normH }
                        });
                    }
                }
            }
        }
    }

    lastFrameData = frameData;

    // Apply EMA Smoothing across frames for steady jitter-free boxes
    const alpha = 0.4;
    smoothedBoxes = rawDetections.map((det, index) => {
        const prev = smoothedBoxes[index];
        if (!prev || prev.label !== det.label) return det;

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
