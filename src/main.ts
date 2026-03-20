import { TICK_DURATION } from './constants';
import { createGameState, simulateTick } from './physics/engine';
import { render } from './render/renderer';
import { renderTouchOverlay } from './render/touch-overlay';
import { resizeCanvas } from './render/camera';
import { initInput, readInputP1, readInputP2, readInput } from './input/input';
import { GameHost } from './net/host';
import { GameClient } from './net/client';
import type { GameState, InputFrame } from './types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let camera = resizeCanvas(canvas);
window.addEventListener('resize', () => {
  camera = resizeCanvas(canvas);
});

initInput();

// --- Mode detection from URL hash ---
// #host         → create a room as host
// #room=<id>    → join room as client
// (no hash)     → local 2-player mode
const hash = window.location.hash;

if (hash.startsWith('#room=')) {
  startClientMode(hash.slice(6));
} else if (hash === '#host') {
  startHostMode();
} else {
  startLocalMode();
}

// === Local Mode (Phase 2 — same keyboard, two players) ===
function startLocalMode(): void {
  const state = createGameState(1, 1);
  let lastTime = performance.now();
  let accumulator = 0;

  function loop(now: number): void {
    const dt = now - lastTime;
    lastTime = now;
    accumulator += dt;

    while (accumulator >= TICK_DURATION) {
      const inputs = new Map<number, InputFrame>();
      inputs.set(0, readInputP1());
      inputs.set(1, readInputP2());
      simulateTick(state, inputs);
      accumulator -= TICK_DURATION;
    }

    render(ctx, state, camera);
    renderTouchOverlay(ctx);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// === Host Mode ===
function startHostMode(): void {
  const statusEl = showStatus('Creating room...');

  const host = new GameHost({
    onReady: (peerId) => {
      const url = `${window.location.origin}${window.location.pathname}#room=${peerId}`;
      statusEl.innerHTML = `
        <div style="text-align:center;color:#fff;font-family:sans-serif;">
          <h2>Room Ready</h2>
          <p>Share this link:</p>
          <input id="room-link" type="text" value="${url}" readonly
            style="width:400px;padding:8px;font-size:14px;text-align:center;cursor:pointer;"
            onclick="this.select()">
          <p id="player-count">Players: 1 (Host)</p>
          <button id="start-btn" style="padding:12px 24px;font-size:16px;cursor:pointer;margin-top:16px;">
            Start Game
          </button>
        </div>
      `;

      document.getElementById('start-btn')!.addEventListener('click', () => {
        host.startGame();
      });
    },
    onPlayerJoin: (_player) => {
      const players = host.getLobbyPlayers();
      updatePlayerCount(players.length);
    },
    onPlayerLeave: () => {
      const players = host.getLobbyPlayers();
      updatePlayerCount(players.length);
    },
    onGameStart: () => {
      removeStatus();
      startHostGameLoop(host);
    },
    onTick: () => {},
  });

  host.start().catch((err) => {
    statusEl.textContent = `Error: ${err.message}`;
  });
}

function startHostGameLoop(host: GameHost): void {
  function loop(): void {
    // Read host's local input and send to host
    host.setHostInput(readInput());

    // Render the authoritative state
    const state = host.getState();
    if (state) {
      render(ctx, state, camera);
    }
    renderTouchOverlay(ctx);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// === Client Mode ===
function startClientMode(hostPeerId: string): void {
  const statusEl = showStatus('Connecting...');
  let gameStarted = false;
  let renderState: GameState | null = null;

  const client = new GameClient({
    onConnected: () => {
      statusEl.textContent = 'Connected! Joining...';
      client.join('Player');
    },
    onWelcome: (_playerId) => {
      statusEl.textContent = 'Waiting for host to start...';
    },
    onPlayerList: (_players) => {},
    onGameStart: () => {
      gameStarted = true;
      removeStatus();
    },
    onStateUpdate: (state) => {
      renderState = state;
    },
    onDisconnect: () => {
      showStatus('Disconnected from host');
    },
  });

  client.connect(hostPeerId).catch((err) => {
    statusEl.textContent = `Connection failed: ${err.message}`;
  });

  // Client render + input loop
  function loop(): void {
    if (gameStarted) {
      // Send local input to host
      client.sendInput(readInput());

      // Re-interpolate for smooth rendering even between server updates
      client.interpolate();

      if (renderState) {
        render(ctx, renderState, camera);
      }
    }
    renderTouchOverlay(ctx);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// === UI Helpers ===
function showStatus(text: string): HTMLDivElement {
  let el = document.getElementById('status-overlay') as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = 'status-overlay';
    el.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);z-index:100;color:#fff;font-family:sans-serif;font-size:20px;';
    document.body.appendChild(el);
  }
  el.textContent = text;
  return el;
}

function removeStatus(): void {
  document.getElementById('status-overlay')?.remove();
}

function updatePlayerCount(count: number): void {
  const el = document.getElementById('player-count');
  if (el) el.textContent = `Players: ${count}`;
}
