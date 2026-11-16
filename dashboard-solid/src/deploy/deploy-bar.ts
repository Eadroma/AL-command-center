/**
 * The Save → Preview → Deploy bar (pure, tested without a browser): which step the player is on, and why deploying
 * is not possible yet. The server enforces the same rules; the bar only says them before the click.
 */
export type BarStep = 'none' | 'save' | 'preview' | 'deploy';

export type DeployBlocker = 'noProfile' | 'unsaved' | 'notPreviewed' | 'locked' | 'busy' | null;

export interface BarInput {
  /** Saved profile revision; null when there is no profile yet. */
  readonly savedRevision: number | null;
  readonly dirty: boolean;
  /** Revision the server last previewed successfully. */
  readonly previewedRevision: number | null;
  /** settings.json deploy.enabled. */
  readonly enabled: boolean;
  /** An operation is in flight (saving, previewing, deploying). */
  readonly busy: boolean;
}

export function barStep(input: BarInput): BarStep {
  if (input.savedRevision === null) {
    return 'none';
  }
  if (input.dirty) {
    return 'save';
  }
  return input.previewedRevision === input.savedRevision ? 'deploy' : 'preview';
}

/** The first thing that stops a deployment, in the order the player has to deal with them. */
export function deployBlocker(input: BarInput): DeployBlocker {
  const step = barStep(input);
  const byStep: Readonly<Record<BarStep, DeployBlocker>> = { none: 'noProfile', save: 'unsaved', preview: 'notPreviewed', deploy: null };
  const blocked = byStep[step];
  if (blocked !== null) {
    return blocked;
  }
  if (!input.enabled) {
    return 'locked';
  }
  return input.busy ? 'busy' : null;
}
