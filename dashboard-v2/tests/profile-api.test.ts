import { afterEach, describe, expect, it, vi } from 'vitest';
import { deployProfile } from '../src/api/profile';

afterEach(() => vi.unstubAllGlobals());

describe('deployment response handling', () => {
  it('reports partial failures even with HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false, failures: [{ character: 'Mage', error: 'Already deploying' }],
    }))));
    await expect(deployProfile(7)).rejects.toThrow('Mage: Already deploying');
  });
  it('sends the saved revision and accepts a fully successful response', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"ok":true,"failures":[]}'));
    vi.stubGlobal('fetch', fetch);
    await expect(deployProfile(7)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/deploy-party', expect.objectContaining({
      method: 'POST', body: '{"version":7}',
    }));
  });
  it('does not retry a failed deployment automatically', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Network interrupted'));
    vi.stubGlobal('fetch', fetch);
    await expect(deployProfile(7)).rejects.toThrow('Network interrupted');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
