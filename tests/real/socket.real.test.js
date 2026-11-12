import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { io } from 'socket.io-client';
import { BASE, closeDb, seedUser, removeUsers, mintToken, backendReachable } from './helpers';

let A; let B; let ta; let tb; const open = [];
beforeAll(async () => {
  if (!(await backendReachable())) throw new Error('Real backend is not reachable on :3000 - see TEST_PLAN.md');
  A = await seedUser('sockA'); B = await seedUser('sockB');
  ta = mintToken(A); tb = mintToken(B);
});
afterEach(() => { while (open.length) open.pop().disconnect(); });
afterAll(async () => { await removeUsers([A, B]); await closeDb(); });

const connect = (token, cameraId) => new Promise((resolve, reject) => {
  const s = io(BASE, { auth: { token, cameraId }, transports: ['websocket'], reconnection: false, forceNew: true });
  open.push(s);
  s.on('connect', () => resolve(s));
  s.on('connect_error', (e) => reject(e));
});
const once = (s, ev, ms = 3000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timed out waiting for "${ev}"`)), ms);
  s.once(ev, (...args) => { clearTimeout(t); resolve(args); });
});
const silent = (s, ev, ms = 600) => new Promise((resolve) => { let got = false; s.once(ev, () => { got = true; }); setTimeout(() => resolve(!got), ms); });

/* The server only RELAYS signalling. These tests prove the relay contract with real Socket.IO clients; they do NOT prove
   that a WebRTC peer connection or camera works (that needs browsers/hardware: see the Playwright real tests and the manual list). */
describe('REAL backend - Socket.IO authentication', () => {
  it('rejects a connection without a token', async () => {
    await expect(connect(undefined)).rejects.toThrow(/authentication required/i);
  });
  it('rejects a forged token', async () => {
    await expect(connect('a.b.c')).rejects.toThrow(/authentication required/i);
  });
  it('accepts a valid session token', async () => {
    const s = await connect(ta, 'mobile');
    expect(s.connected).toBe(true);
  });
});

describe('REAL backend - WebRTC signalling relay (same account, same camera)', () => {
  it('watcher announces -> broadcaster is told; offer/answer/candidate are relayed to the right peer', async () => {
    const broadcaster = await connect(ta, 'mobile');
    broadcaster.emit('broadcaster', 'mobile');
    const viewer = await connect(ta, 'mobile');
    const watcherSeen = once(broadcaster, 'watcher');
    viewer.emit('watcher', 'mobile');
    const [viewerId, camId] = await watcherSeen;
    expect(viewerId).toBe(viewer.id);
    expect(camId).toBe('mobile');

    const offerSeen = once(viewer, 'offer');
    broadcaster.emit('offer', viewerId, { type: 'offer', sdp: 'v=0 test-offer' });
    const [fromB, offer] = await offerSeen;
    expect(fromB).toBe(broadcaster.id);
    expect(offer).toEqual({ type: 'offer', sdp: 'v=0 test-offer' });

    const answerSeen = once(broadcaster, 'answer');
    viewer.emit('answer', broadcaster.id, { type: 'answer', sdp: 'v=0 test-answer' });
    const [fromV, answer] = await answerSeen;
    expect(fromV).toBe(viewer.id);
    expect(answer.sdp).toBe('v=0 test-answer');

    const candSeen = once(viewer, 'candidate');
    broadcaster.emit('candidate', viewerId, { candidate: 'candidate:1 1 UDP 1 127.0.0.1 9 typ host' });
    expect((await candSeen)[1].candidate).toContain('typ host');
  });
  it('tells watchers when the broadcaster (re)appears and when it disconnects', async () => {
    const viewer = await connect(ta, 'mobile');
    const broadcaster = await connect(ta, 'mobile');
    const appeared = once(viewer, 'broadcaster');
    broadcaster.emit('broadcaster', 'mobile');
    await appeared;
    const broadcasterId = broadcaster.id; // a socket's id is cleared once it disconnects
    const gone = once(viewer, 'disconnectPeer');
    broadcaster.disconnect();
    expect((await gone)[0]).toBe(broadcasterId);
  });
});

describe('REAL backend - isolation', () => {
  it('another account\'s viewer never reaches this account\'s broadcaster', async () => {
    const broadcaster = await connect(ta, 'mobile'); broadcaster.emit('broadcaster', 'mobile');
    const stranger = await connect(tb, 'mobile');
    const quiet = silent(broadcaster, 'watcher');
    stranger.emit('watcher', 'mobile');
    expect(await quiet).toBe(true);
  });
  it('cannot send an offer to a socket of another account', async () => {
    const mine = await connect(ta, 'mobile'); const theirs = await connect(tb, 'mobile');
    const quiet = silent(theirs, 'offer');
    mine.emit('offer', theirs.id, { type: 'offer', sdp: 'x' });
    expect(await quiet).toBe(true);
  });
  it('a different camera of the same account is a separate room', async () => {
    const broadcaster = await connect(ta, 'mobile'); broadcaster.emit('broadcaster', 'mobile');
    const otherCam = await connect(ta, 'garage');
    const quiet = silent(broadcaster, 'watcher');
    otherCam.emit('watcher', 'garage');
    expect(await quiet).toBe(true);
  });
});
