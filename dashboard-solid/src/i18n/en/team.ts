/** Team screen. */
export const team = {
  title: 'Team',
  hp: 'HP',
  mp: 'MP',
  level: (params: { readonly level: number }): string => `level ${params.level}`,
  live: 'live',
  seenAgo: (params: { readonly ago: string }): string => `seen ${params.ago}`,
  idle: 'No activity reported',
  unknownMap: 'Unknown map',
  silent: (params: { readonly count: number }): string => (params.count === 1 ? '1 character without telemetry' : `${params.count} characters without telemetry`),
  silentHelp: 'Nothing received from these characters yet. If they run in Chrome, open the adventure.land tab and allow local network access (icon left of the address bar), then reload the game.',
  empty: 'No character reports yet. Start your scripts in the game: they appear here within a few seconds.',
  connectionOpen: 'Live',
  connectionConnecting: 'Connecting…',
  connectionClosed: 'Offline: reconnecting',
};
