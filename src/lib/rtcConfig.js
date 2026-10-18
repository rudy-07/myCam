import { authFetch } from './api';

const FALLBACK_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

/** Load per-deployment ICE servers from the authenticated API. TURN is optional. */
export async function loadIceServers() {
  try {
    const response = await authFetch('/api/rtc-config');
    if (!response.ok) throw new Error(`ICE configuration returned ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body?.iceServers) || body.iceServers.length === 0) throw new Error('ICE configuration is empty');
    return body.iceServers;
  } catch (error) {
    console.warn('[WebRTC] Using fallback STUN configuration:', error.message);
    return FALLBACK_ICE_SERVERS;
  }
}
