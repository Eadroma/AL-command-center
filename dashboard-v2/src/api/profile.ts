import { api } from './client';
import type { Profile } from '../types';
import type { ProfileSnapshot } from '../models/profile';

interface DeployPartyResponse {
  ok: boolean;
  failures: Array<{ character: string; error: string }>;
}

/** Persist the complete draft against its original server revision. */
export function saveProfile(profile: Profile, version: number): Promise<ProfileSnapshot> {
  return api<ProfileSnapshot>('/api/profile', { profile, version }, 'PUT');
}

/** A successful HTTP response may still describe individual character failures. */
export async function deployProfile(version: number): Promise<void> {
  const result = await api<DeployPartyResponse>('/api/deploy-party', { version });
  if (!result.ok) {
    const details = result.failures.map(failure => `${failure.character}: ${failure.error}`).join(' · ');
    throw new Error(details || 'Deployment failed.');
  }
}

/** Deploy CODE bundle for a single character. */
export async function deployCharacter(character: string, version: number): Promise<void> {
  await api('/api/deploy', { character, version });
}

/** Stop CODE execution on a single character. */
export async function stopCharacter(character: string): Promise<void> {
  await api('/api/control', { character, action: 'stop' });
}

/** Stop CODE execution across all enabled characters. */
export async function stopParty(): Promise<void> {
  const result = await api<{ ok: boolean; failures: Array<{ character: string; error: string }> }>('/api/control-party', { action: 'stop' });
  if (!result.ok && result.failures?.length) {
    const details = result.failures.map(failure => `${failure.character}: ${failure.error}`).join(' · ');
    throw new Error(details || 'Party stop failed.');
  }
}

