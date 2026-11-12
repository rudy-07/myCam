import { vi } from 'vitest';

/** Minimal stand-in for a socket.io-client socket. Replaces only the network transport. */
export function createFakeSocket() {
  const handlers = {};
  const socket = {
    connected: false,
    handlers,
    emitted: [],
    on: vi.fn((ev, fn) => { (handlers[ev] ||= []).push(fn); return socket; }),
    off: vi.fn((ev, fn) => { handlers[ev] = (handlers[ev] || []).filter((h) => h !== fn); return socket; }),
    once: vi.fn((ev, fn) => socket.on(ev, fn)),
    emit: vi.fn((ev, ...args) => { socket.emitted.push([ev, ...args]); return socket; }),
    connect: vi.fn(() => socket),
    disconnect: vi.fn(() => { socket.connected = false; return socket; }),
    close: vi.fn(),
    io: { on: vi.fn(), off: vi.fn() },
    trigger: (ev, ...args) => (handlers[ev] || []).slice().forEach((fn) => fn(...args)),
  };
  return socket;
}
