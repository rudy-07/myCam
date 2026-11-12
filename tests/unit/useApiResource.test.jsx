import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useApiResource, { requireArray } from '../../src/hooks/useApiResource';
import { installFetch, jsonResponse, textResponse } from '../helpers/fetch';

describe('useApiResource', () => {
  it('starts loading then provides validated data', async () => {
    installFetch(() => jsonResponse([1, 2]));
    const { result } = renderHook(() => useApiResource('/api/x', requireArray));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    expect(result.current).toMatchObject({ loading: false, refreshing: false, error: '' });
  });
  it('makes no request without a URL', async () => {
    const f = installFetch(() => jsonResponse([]));
    renderHook(() => useApiResource(null, requireArray));
    await new Promise((r) => setTimeout(r, 20));
    expect(f).not.toHaveBeenCalled();
  });
  it('reports the server message on failure', async () => {
    installFetch(() => jsonResponse({ message: 'Failed to fetch zones' }, 500));
    const { result } = renderHook(() => useApiResource('/api/x', requireArray));
    await waitFor(() => expect(result.current.error).toBe('Failed to fetch zones'));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });
  it('rejects a response that fails validation', async () => {
    installFetch(() => jsonResponse({ not: 'a list' }));
    const { result } = renderHook(() => useApiResource('/api/x', requireArray));
    await waitFor(() => expect(result.current.error).toMatch(/not a list/));
  });
  it('rejects an HTML/non-JSON success body', async () => {
    installFetch(() => textResponse('<html>', 200));
    const { result } = renderHook(() => useApiResource('/api/x', requireArray));
    await waitFor(() => expect(result.current.error).toMatch(/not valid data/));
  });
  it('keeps the last good data when a refresh fails', async () => {
    let fail = false;
    installFetch(() => (fail ? jsonResponse({ message: 'down' }, 503) : jsonResponse(['a'])));
    const { result } = renderHook(() => useApiResource('/api/x', requireArray));
    await waitFor(() => expect(result.current.data).toEqual(['a']));
    fail = true;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe('down'));
    expect(result.current.data).toEqual(['a']);
  });
  it('setData patches held data and accepts an updater function', async () => {
    installFetch(() => jsonResponse([1, 2, 3]));
    const { result } = renderHook(() => useApiResource('/api/x', requireArray));
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    act(() => result.current.setData((list) => list.filter((n) => n !== 2)));
    expect(result.current.data).toEqual([1, 3]);
  });
  it('does not show data from a previous URL', async () => {
    installFetch(({ url }) => jsonResponse(url.endsWith('/a') ? ['A'] : ['B']));
    const { result, rerender } = renderHook(({ u }) => useApiResource(u, requireArray), { initialProps: { u: '/a' } });
    await waitFor(() => expect(result.current.data).toEqual(['A']));
    rerender({ u: '/b' });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toEqual(['B']));
  });
  it('aborts the in-flight request on unmount without erroring', async () => {
    let signal;
    installFetch(({ signal: s }) => { signal = s; return new Promise(() => {}); });
    const { unmount } = renderHook(() => useApiResource('/api/x', requireArray));
    await waitFor(() => expect(signal).toBeTruthy());
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
