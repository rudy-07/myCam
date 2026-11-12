// Motion-alert policy (documented in TESTING_GUIDE.md, Tests 7 and 8):
//  - With no saved zone for a camera, motion anywhere in the picture raises an alert.
//  - With saved zones, only motion whose centre is inside a zone raises an alert.
//  - A zone whose coordinates cannot be read is ignored; it must not switch the zone filter off for the valid zones.
import { parseCoordinates, MIN_POINTS } from './zones';
import { isBoxIntersectingZone } from '../utils/aiDetector';

export const usableZones = (zones) =>
  (Array.isArray(zones) ? zones : []).filter((zone) => {
    const points = parseCoordinates(zone?.coordinates_json);
    return Array.isArray(points) && points.length >= MIN_POINTS;
  });

export function evaluateMotion(box, zones) {
  const valid = usableZones(zones);
  const hasZones = valid.length > 0;
  const inZone = hasZones && valid.some((zone) => isBoxIntersectingZone(box, zone.coordinates_json));
  return { hasZones, inZone, shouldAlert: !hasZones || inZone };
}

export const motionAlertMessage = (cameraName, hasZones) =>
  hasZones ? `Motion detected inside an activity zone on ${cameraName}` : `Motion detected on ${cameraName}`;
