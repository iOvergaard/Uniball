/**
 * Vite plugin that starts a local PeerJS signaling server on port 9000.
 * Avoids depending on the public PeerJS cloud for dev.
 * Only runs during `vite serve`, not during test or build.
 */
export function peerServerPlugin() {
  return {
    name: 'peerjs-server',
    apply: 'serve',
    configureServer() {
      import('peer').then(({ PeerServer }) => {
        try {
          const server = PeerServer({ port: 9000, path: '/peerjs', host: '0.0.0.0' });
          server.on('error', (err) => {
            console.warn('[peerjs] Server error (non-fatal):', err.message);
          });
          console.log('[peerjs] Local signaling server running on 0.0.0.0:9000');
        } catch (err) {
          console.warn('[peerjs] Could not start local server:', err.message);
        }
      });
    },
  };
}
