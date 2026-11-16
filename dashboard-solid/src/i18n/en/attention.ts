/** "To handle" banner on the Team screen. `reason` is the script's own diagnosis, shown as-is. */
export const attention = {
  title: 'To handle',
  none: 'Nothing to handle: every reporting character is fine.',
  death: (params: { readonly name: string; readonly ago: string; readonly reason: string }): string => `${params.name} died ${params.ago} (${params.reason}).`,
  lowHp: (params: { readonly name: string; readonly percent: number }): string => `${params.name} is down to ${params.percent}% HP.`,
  silent: (params: { readonly name: string; readonly ago: string }): string => `${params.name} stopped reporting: last seen ${params.ago}.`,
  never: (params: { readonly name: string }): string => `Nothing received from ${params.name} yet.`,
  gameData: 'The last game data update failed. The previous data is still in use.',
  show: 'Show',
  dismiss: 'Dismiss',
  retry: 'Update now',
};
