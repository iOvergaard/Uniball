import { TICK_DURATION } from './constants';
import { createGameState, simulateTick } from './physics/engine';
import { render } from './render/renderer';
import { renderTouchOverlay } from './render/touch-overlay';
import { resizeCanvas } from './render/camera';
import { initInput, readInputP1, readInputP2, readInput } from './input/input';
import { GameHost } from './net/host';
import { GameClient } from './net/client';
import {
  showLandingScreen,
  showHostLobby,
  showClientLobby,
  updateLobbyPlayers,
  hideLobby,
  showLobbyStatus,
  appendChatMessage,
} from './ui/lobby-ui';
import { showDisconnected, showGameOver, showNotification } from './ui/screens';
import { setMuted, isMuted } from './audio/sfx';
import type { GameState, InputFrame, LobbyPlayer, Team } from './types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let camera = resizeCanvas(canvas);
window.addEventListener('resize', () => {
  camera = resizeCanvas(canvas);
});

initInput();

// M key toggles mute
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') setMuted(!isMuted());
});

// --- Mode detection from URL hash ---
// #room=<id>  → show landing with join pre-filled
// (anything)  → show landing screen
const hash = window.location.hash;
const roomIdFromHash = hash.startsWith('#room=') ? hash.slice(6) : undefined;

showLandingScreen(
  {
    onCreateRoom: (name) => startHostMode(name),
    onJoinRoom: (name, roomId) => startClientMode(name, roomId),
    onLocalPlay: () => {
      hideLobby();
      startLocalMode();
    },
    onTeamChange: () => {},
    onStartGame: () => {},
  },
  roomIdFromHash,
);

// === Local Mode (Phase 2 — same keyboard, two players) ===
function startLocalMode(): void {
  const state = createGameState(1, 1);
  let lastTime = performance.now();
  let accumulator = 0;
  let gameOverShown = false;

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
    if (state.phase === 'ended' && !gameOverShown) {
      gameOverShown = true;
      showGameOver();
    }
    renderTouchOverlay(ctx);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// === Host Mode ===
function startHostMode(hostName: string): void {
  showLobbyStatus('Creating room...');

  let currentTeam: Team = 'red';

  const host = new GameHost({
    onReady: (peerId) => {
      const url = `${window.location.origin}${window.location.pathname}#room=${peerId}`;
      host.setHostName(hostName);
      host.setHostTeam(currentTeam);

      showHostLobby(url, host.getLobbyPlayers(), {
        onCreateRoom: () => {},
        onJoinRoom: () => {},
        onLocalPlay: () => {},
        onTeamChange: (team: Team) => {
          currentTeam = team;
          host.setHostTeam(team);
          updateLobbyPlayers(host.getLobbyPlayers());
        },
        onStartGame: () => {
          host.startGame();
        },
        onChat: (text: string) => {
          host.sendChat(text);
        },
      });
    },
    onPlayerJoin: (_player: LobbyPlayer) => {
      updateLobbyPlayers(host.getLobbyPlayers());
    },
    onPlayerLeave: () => {
      updateLobbyPlayers(host.getLobbyPlayers());
    },
    onPlayerDisconnect: (playerName: string) => {
      showNotification(`${playerName} left the game`);
    },
    onGameStart: () => {
      hideLobby();
      startHostGameLoop(host);
    },
    onTick: () => {},
    onChat: (name: string, text: string) => {
      appendChatMessage(name, text);
    },
  });

  host.start().catch((err) => {
    showLobbyStatus(`Error: ${err.message}`);
  });
}

function startHostGameLoop(host: GameHost): void {
  let gameOverShown = false;

  function loop(): void {
    host.setHostInput(readInput());

    const state = host.getState();
    if (state) {
      render(ctx, state, camera);
      if (state.phase === 'ended' && !gameOverShown) {
        gameOverShown = true;
        showGameOver();
      }
    }
    renderTouchOverlay(ctx);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// === Client Mode ===
function startClientMode(playerName: string, hostPeerId: string): void {
  showLobbyStatus('Connecting...');

  let gameStarted = false;
  let gameOverShown = false;
  let renderState: GameState | null = null;

  const client = new GameClient({
    onConnected: () => {
      client.join(playerName);
    },
    onWelcome: (_playerId) => {
      showClientLobby([], {
        onCreateRoom: () => {},
        onJoinRoom: () => {},
        onLocalPlay: () => {},
        onTeamChange: (team: Team) => {
          client.setTeam(team);
        },
        onStartGame: () => {},
        onChat: (text: string) => {
          client.sendChat(text);
        },
      });
    },
    onPlayerList: (players: LobbyPlayer[]) => {
      updateLobbyPlayers(players);
    },
    onGameStart: () => {
      gameStarted = true;
      hideLobby();
    },
    onStateUpdate: (state: GameState) => {
      renderState = state;
    },
    onDisconnect: () => {
      showDisconnected();
    },
    onPlayerLeft: (playerName: string) => {
      showNotification(`${playerName} left the game`);
    },
    onRejected: (reason: string) => {
      showLobbyStatus(`Rejected: ${reason}`);
    },
    onChat: (name: string, text: string) => {
      appendChatMessage(name, text);
    },
  });

  client.connect(hostPeerId).catch((err) => {
    showLobbyStatus(`Connection failed: ${err.message}`);
  });

  function loop(): void {
    if (gameStarted) {
      client.sendInput(readInput());
      client.interpolate();

      if (renderState) {
        render(ctx, renderState, camera);
        if (renderState.phase === 'ended' && !gameOverShown) {
          gameOverShown = true;
          showGameOver();
        }
      }
    }
    renderTouchOverlay(ctx);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}
