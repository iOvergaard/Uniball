import type { PeerOptions } from 'peerjs';

/**
 * Returns PeerJS config.
 *
 * Priority:
 * 1. VITE_PEER_HOST env var → custom self-hosted server
 *    e.g. VITE_PEER_HOST=myserver.com VITE_PEER_PORT=9000
 * 2. Dev mode → local PeerJS server on port 9000
 * 3. Production fallback → PeerJS cloud (0.peerjs.com)
 */
export function getPeerConfig(): PeerOptions {
  const customHost = import.meta.env.VITE_PEER_HOST;
  if (customHost) {
    return {
      host: customHost,
      port: Number(import.meta.env.VITE_PEER_PORT || 9000),
      path: import.meta.env.VITE_PEER_PATH || '/peerjs',
      secure: import.meta.env.VITE_PEER_SECURE === 'true',
    };
  }

  if (import.meta.env.DEV) {
    return {
      host: window.location.hostname,
      port: 9000,
      path: '/peerjs',
      secure: false,
    };
  }

  // Production: use PeerJS cloud (default)
  return {};
}
