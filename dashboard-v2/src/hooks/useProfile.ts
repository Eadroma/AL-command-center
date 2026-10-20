import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { saveProfile, deployProfile, deployCharacter, stopCharacter, stopParty } from '../api/profile';
import type { BootstrapResponse } from './useBootstrap';
import { isDirty, updateAutomation, updateCharacterScript } from '../models/profile';
import type { AutomationKey, ProfileDraft, ProfileSnapshot } from '../models/profile';
import type { Profile } from '../../shared/schema';

/** Own a revision-bound draft; remote refreshes must never overwrite unsaved edits. */
export function useProfile(remote: ProfileSnapshot | undefined) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const lock = useRef(false);
  const dirty = isDirty(draft);
  const snapshot = dirty && draft ? draft.base : remote;
  const profile = dirty && draft ? draft.profile : remote?.profile;
  const conflict = dirty && remote?.version !== draft?.base.version;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(key: AutomationKey, value: boolean) {
    if (!snapshot || !profile || lock.current) return;
    setError(undefined);
    setNotice(undefined);
    setDraft({ base: snapshot, profile: updateAutomation(profile, key, value) });
  }

  function replace(next: Profile) {
    if (!snapshot || !profile || lock.current) return;
    setError(undefined);
    setNotice(undefined);
    setDraft({ base: snapshot, profile: next });
  }
  function changeScript(characterName: string, scriptId: string) {
    if (!snapshot || !profile || lock.current) return;
    setError(undefined);
    setNotice(undefined);
    setDraft({ base: snapshot, profile: updateCharacterScript(profile, characterName, scriptId) });
  }


  async function execute(action: 'save' | 'deploy') {
    if (!snapshot || !profile || lock.current || conflict || (action === 'deploy' && dirty)) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      if (action === 'save') {
        // Cancel older reads so they cannot replace the newly saved revision.
        await client.cancelQueries({ queryKey: ['bootstrap'] });
        const saved = await saveProfile(profile, snapshot.version);
        await client.cancelQueries({ queryKey: ['bootstrap'] });
        client.setQueryData<BootstrapResponse>(['bootstrap'], previous =>
          previous ? { ...previous, ...saved } : undefined,
        );
        setDraft(null);
        setNotice(`Profile saved · revision ${saved.version}. Deploy to apply in game.`);
      } else {
        await deployProfile(snapshot.version);
        setNotice('Deployment requested. Awaiting live telemetry confirmation.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed.');
    } finally {
      lock.current = false;
      setPending(false);
      void client.invalidateQueries({ queryKey: ['bootstrap'] });
      void client.invalidateQueries({ queryKey: ['deployments'] });
    }
  }

  async function handleStopParty() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await stopParty();
      setNotice('Stop requested for all party characters.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to stop party.');
    } finally {
      lock.current = false;
      setPending(false);
      void client.invalidateQueries({ queryKey: ['bootstrap'] });
      void client.invalidateQueries({ queryKey: ['deployments'] });
    }
  }

  async function handleDeployCharacter(characterName: string) {
    if (!snapshot || lock.current || dirty) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await deployCharacter(characterName, snapshot.version);
      setNotice(`Deployment requested for ${characterName}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to deploy ${characterName}.`);
    } finally {
      lock.current = false;
      setPending(false);
      void client.invalidateQueries({ queryKey: ['deployments'] });
    }
  }

  async function handleStopCharacter(characterName: string) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await stopCharacter(characterName);
      setNotice(`Stop requested for ${characterName}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to stop ${characterName}.`);
    } finally {
      lock.current = false;
      setPending(false);
      void client.invalidateQueries({ queryKey: ['deployments'] });
    }
  }

  return {
    profile, baseProfile: snapshot?.profile, dirty, conflict, pending, error, notice,
    version: snapshot?.version,
    change, replace, changeScript,
    save: () => void execute('save'),
    deploy: () => void execute('deploy'),
    stopParty: () => void handleStopParty(),
    deployCharacter: (name: string) => void handleDeployCharacter(name),
    stopCharacter: (name: string) => void handleStopCharacter(name),
    discard: () => {
      if (lock.current) return;
      setDraft(null);
      setError(undefined);
      setNotice(undefined);
    },
  };
}
