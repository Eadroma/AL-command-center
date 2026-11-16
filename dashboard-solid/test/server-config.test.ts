/** Port resolution and startup error messages. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_PORT, resolvePort } from '../server/config.ts';
import { describeListenError } from '../server/listen-error.ts';

describe('resolvePort', () => {
  it('uses the default when ALCC_PORT is absent or empty', () => {
    assert.equal(resolvePort({}), DEFAULT_PORT);
    assert.equal(resolvePort({ ALCC_PORT: '' }), DEFAULT_PORT);
  });

  it('accepts a valid port', () => {
    assert.equal(resolvePort({ ALCC_PORT: '9321' }), 9321);
  });

  it('rejects invalid values with an explicit message', () => {
    for (const value of ['abc', '80', '70000', '93.5']) {
      assert.throws(() => resolvePort({ ALCC_PORT: value }), /ALCC_PORT must be an integer/);
    }
  });
});

describe('describeListenError', () => {
  it('names the busy port and the fix', () => {
    const error = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
    assert.match(describeListenError(error, 9320), /port 9320 is already in use.*ALCC_PORT/);
  });

  it('falls back to the original message', () => {
    assert.equal(describeListenError(new Error('boom'), 9320), 'boom');
  });
});
