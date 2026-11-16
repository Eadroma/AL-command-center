/** Save → Preview → Deploy bar: the step shown and what blocks deploying. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BarInput } from '../src/deploy/deploy-bar.ts';
import { barStep, deployBlocker } from '../src/deploy/deploy-bar.ts';

const ready: BarInput = { savedRevision: 4, dirty: false, previewedRevision: 4, enabled: true, busy: false };

describe('deploy bar', () => {
  it('walks through save, preview, deploy', () => {
    assert.equal(barStep({ ...ready, savedRevision: null }), 'none');
    assert.equal(barStep({ ...ready, dirty: true }), 'save');
    assert.equal(barStep({ ...ready, previewedRevision: null }), 'preview');
    assert.equal(barStep({ ...ready, previewedRevision: 3 }), 'preview');
    assert.equal(barStep(ready), 'deploy');
  });

  it('names the first blocker, unsaved edits before the lock', () => {
    assert.equal(deployBlocker({ ...ready, savedRevision: null }), 'noProfile');
    assert.equal(deployBlocker({ ...ready, dirty: true, enabled: false }), 'unsaved');
    assert.equal(deployBlocker({ ...ready, previewedRevision: 3, enabled: false }), 'notPreviewed');
    assert.equal(deployBlocker({ ...ready, enabled: false }), 'locked');
    assert.equal(deployBlocker({ ...ready, busy: true }), 'busy');
    assert.equal(deployBlocker(ready), null);
  });
});
