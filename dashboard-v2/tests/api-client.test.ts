import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client';

afterEach(() => vi.unstubAllGlobals());

describe('JSON API transport', () => {
  it('preserves version conflicts for the editor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Profile changed in another window.' }), { status: 409 })));
    await expect(api('/api/profile', { version: 1 }, 'PUT')).rejects.toThrow('another window');
  });
  it('does not turn HTML fallback responses into successful empty data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Not an API</html>')));
    await expect(api('/api/bootstrap')).rejects.toThrow('invalid JSON');
  });
  it('supports falsy JSON bodies and propagates cancellation', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    await api('/test', false, 'PUT', controller.signal);
    expect(fetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'PUT', body: 'false', signal: controller.signal }));
  });
});
