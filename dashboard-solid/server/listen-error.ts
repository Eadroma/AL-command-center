/** Human-readable reason for a server that cannot start listening. */
export function describeListenError(error: NodeJS.ErrnoException, port: number): string {
  switch (error.code) {
    case 'EADDRINUSE':
      return `port ${port} is already in use (dashboard-v2 uses 9320). Set ALCC_PORT to a free port.`;
    case 'EACCES':
      return `port ${port} needs elevated rights. Choose a port above 1024.`;
    default:
      return error.message;
  }
}
