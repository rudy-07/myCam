import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/*
 * Browser-API stand-ins that jsdom does not implement. These replace ONLY the
 * platform; application code under test is never mocked here.
 */
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.body.style.overflow = '';

  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

afterEach(() => { cleanup(); });

if (!window.ResizeObserver) {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// jsdom has no canvas; provide a recording 2d context so drawing code can run.
HTMLCanvasElement.prototype.getContext = function getContext() {
  const noop = () => {};
  return {
    clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, moveTo: noop, lineTo: noop,
    closePath: noop, fill: noop, stroke: noop, arc: noop, setLineDash: noop, setTransform: noop,
    fillText: noop, drawImage: noop,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  };
};

// jsdom does not implement media playback. These stand-ins only silence "not implemented" errors.
HTMLMediaElement.prototype.load = function load() {};
HTMLMediaElement.prototype.play = function play() { return Promise.resolve(); };
HTMLMediaElement.prototype.pause = function pause() {};
