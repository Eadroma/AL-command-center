/** Turns an API error code into a sentence in the current language. Unknown codes stay visible, never hidden. */
import type { ApiError } from '../../shared/account.ts';
import { t } from './i18n.ts';

const messages: Readonly<Record<string, (detail: string) => string>> = {
  'mcp.missingToken': () => t('errors.mcpMissingToken'),
  'mcp.unreachable': () => t('errors.mcpUnreachable'),
  'mcp.httpError': (detail) => t('errors.mcpHttpError', { detail }),
  'mcp.rejected': (detail) => t('errors.mcpRejected', { detail }),
  'mcp.unexpectedResponse': () => t('errors.mcpUnexpectedResponse'),
  'http.unreachable': () => t('errors.httpUnreachable'),
  'http.invalidCsrf': () => t('errors.httpInvalidCsrf'),
  'http.forbiddenHost': () => t('errors.httpForbidden'),
  'http.forbiddenOrigin': () => t('errors.httpForbidden'),
  'settings.invalidInput': () => t('errors.settingsInvalidInput'),
  'settings.unknownServer': () => t('errors.settingsUnknownServer'),
  'profile.conflict': () => t('errors.profileConflict'),
  'profile.invalid': () => t('errors.profileInvalid'),
  'profile.noServer': () => t('errors.profileNoServer'),
  'profile.v2Unreachable': () => t('errors.profileV2Unreachable'),
  'profile.v2Invalid': (detail) => t('errors.profileV2Invalid', { detail }),
  'profile.v2NotConfigured': () => t('errors.profileV2NotConfigured'),
  'deploy.disabled': () => t('errors.deployDisabled'),
  'deploy.busy': () => t('errors.deployBusy'),
  'deploy.noSettings': () => t('errors.deployNoSettings'),
  'deploy.noProfile': () => t('errors.deployNoProfile'),
  'deploy.staleProfile': () => t('errors.deployStaleProfile'),
  'deploy.characterDisabled': (detail) => t('errors.deployCharacterDisabled', { detail }),
  'deploy.caracalUnsupported': (detail) => t('errors.deployCaracalUnsupported', { detail }),
  'deploy.noGameData': () => t('errors.deployNoGameData'),
  'deploy.buildFailed': (detail) => t('errors.deployBuildFailed', { detail }),
  'deploy.offline': (detail) => t('errors.deployOffline', { detail }),
  'deploy.duplicateSlots': (detail) => t('errors.deployDuplicateSlots', { detail }),
  'deploy.noFreeSlot': () => t('errors.deployNoFreeSlot'),
  'deploy.backupFailed': () => t('errors.deployBackupFailed'),
  'deploy.verifyFailed': () => t('errors.deployVerifyFailed'),
  'deploy.unexpectedResponse': (detail) => t('errors.deployUnexpectedResponse', { detail }),
  'deploy.noSlot': (detail) => t('errors.deployNoSlot', { detail }),
  'deploy.invalidRequest': () => t('errors.deployInvalidRequest'),
  'deploy.unknownBackup': () => t('errors.deployUnknownBackup'),
  'deploy.notPreviewed': () => t('errors.deployNotPreviewed'),
};

export function errorMessage(error: ApiError): string {
  const message = messages[error.code];
  return message === undefined ? t('errors.unknown', { code: error.code }) : message(error.detail ?? '');
}
