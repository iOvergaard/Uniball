import { RED_TEAM_COLOR, BLUE_TEAM_COLOR } from '../constants';
import type { LobbyPlayer, Team } from '../types';

export interface LobbyUICallbacks {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (name: string, roomId: string) => void;
  onLocalPlay: () => void;
  onTeamChange: (team: Team) => void;
  onStartGame: () => void;
  onChat?: (text: string) => void;
}

/** Root container for all lobby UI */
let root: HTMLDivElement | null = null;

function getRoot(): HTMLDivElement {
  if (!root) {
    root = document.createElement('div');
    root.id = 'lobby-root';
    root.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1a1a2e;z-index:100;font-family:sans-serif;color:#fff;';
    document.body.appendChild(root);
  }
  return root;
}

/** Show the landing screen: create, join, or local play */
export function showLandingScreen(callbacks: LobbyUICallbacks, roomIdFromHash?: string): void {
  const el = getRoot();
  el.innerHTML = `
    <div style="text-align:center;max-width:420px;width:100%;padding:24px;">
      <h1 style="font-size:48px;margin-bottom:4px;">🦄 Uniball</h1>
      <p style="opacity:0.6;margin-bottom:32px;">P2P multiplayer soccer</p>

      <div style="margin-bottom:24px;">
        <label style="display:block;margin-bottom:6px;opacity:0.7;font-size:14px;">Your name</label>
        <input id="lobby-name" type="text" maxlength="12" placeholder="Unicorn"
          style="width:100%;padding:10px;font-size:16px;border-radius:6px;border:1px solid #444;background:#2a2a4a;color:#fff;text-align:center;">
      </div>

      <button id="btn-create" style="width:100%;padding:14px;font-size:16px;border:none;border-radius:8px;background:#e63946;color:#fff;cursor:pointer;margin-bottom:10px;font-weight:bold;">
        Create Room
      </button>
      <button id="btn-join" style="width:100%;padding:14px;font-size:16px;border:none;border-radius:8px;background:#457b9d;color:#fff;cursor:pointer;margin-bottom:10px;font-weight:bold;${roomIdFromHash ? '' : 'display:none;'}">
        Join Room
      </button>
      <div id="join-manual" style="${roomIdFromHash ? 'display:none;' : ''}margin-bottom:10px;">
        <input id="lobby-room-id" type="text" placeholder="Paste room link or ID"
          style="width:100%;padding:10px;font-size:14px;border-radius:6px 6px 0 0;border:1px solid #444;background:#2a2a4a;color:#fff;text-align:center;">
        <button id="btn-join-manual" style="width:100%;padding:12px;font-size:14px;border:none;border-radius:0 0 8px 8px;background:#457b9d;color:#fff;cursor:pointer;font-weight:bold;">
          Join Room
        </button>
      </div>
      <button id="btn-local" style="width:100%;padding:12px;font-size:14px;border:none;border-radius:8px;background:#333;color:#aaa;cursor:pointer;">
        Local 2-Player
      </button>
    </div>
  `;

  const nameInput = document.getElementById('lobby-name') as HTMLInputElement;

  function getName(): string {
    return nameInput.value.trim() || 'Unicorn';
  }

  document.getElementById('btn-create')!.addEventListener('click', () => {
    callbacks.onCreateRoom(getName());
  });

  if (roomIdFromHash) {
    document.getElementById('btn-join')!.addEventListener('click', () => {
      callbacks.onJoinRoom(getName(), roomIdFromHash);
    });
  }

  document.getElementById('btn-join-manual')?.addEventListener('click', () => {
    const raw = (document.getElementById('lobby-room-id') as HTMLInputElement).value.trim();
    // Extract room ID from URL or use as-is
    const match = raw.match(/#room=(.+)/);
    const roomId = match ? match[1] : raw;
    if (roomId) {
      callbacks.onJoinRoom(getName(), roomId);
    }
  });

  document.getElementById('btn-local')!.addEventListener('click', () => {
    callbacks.onLocalPlay();
  });
}

/** Show the host lobby screen with shareable link and player list */
export function showHostLobby(
  roomUrl: string,
  players: LobbyPlayer[],
  callbacks: LobbyUICallbacks,
): void {
  const el = getRoot();
  el.innerHTML = `
    <div style="text-align:center;max-width:480px;width:100%;padding:24px;">
      <h2 style="margin-bottom:16px;">🦄 Room Lobby</h2>

      <div style="margin-bottom:20px;">
        <label style="display:block;margin-bottom:6px;opacity:0.7;font-size:13px;">Share this link</label>
        <input id="room-link" type="text" value="${roomUrl}" readonly
          style="width:100%;padding:8px;font-size:13px;border-radius:6px;border:1px solid #444;background:#2a2a4a;color:#fff;text-align:center;cursor:pointer;"
          onclick="this.select()">
      </div>

      <div id="player-list" style="margin-bottom:20px;"></div>

      <div style="margin-bottom:16px;">
        <label style="opacity:0.7;font-size:13px;margin-right:8px;">Your team:</label>
        <button id="btn-team-red" style="padding:8px 20px;border:2px solid ${RED_TEAM_COLOR};border-radius:6px 0 0 6px;background:${RED_TEAM_COLOR};color:#fff;cursor:pointer;font-weight:bold;">Red</button>
        <button id="btn-team-blue" style="padding:8px 20px;border:2px solid ${BLUE_TEAM_COLOR};border-radius:0 6px 6px 0;background:transparent;color:${BLUE_TEAM_COLOR};cursor:pointer;font-weight:bold;">Blue</button>
      </div>

      <button id="btn-start" style="width:100%;padding:14px;font-size:18px;border:none;border-radius:8px;background:#2d6a4f;color:#fff;cursor:pointer;font-weight:bold;">
        Start Game
      </button>
      <p id="start-hint" style="opacity:0.5;font-size:12px;margin-top:8px;">Need at least 1 player on each team</p>
      ${CHAT_HTML}
    </div>
  `;

  renderPlayerList(players);
  updateTeamButtons('red');

  document.getElementById('btn-team-red')!.addEventListener('click', () => {
    callbacks.onTeamChange('red');
    updateTeamButtons('red');
  });
  document.getElementById('btn-team-blue')!.addEventListener('click', () => {
    callbacks.onTeamChange('blue');
    updateTeamButtons('blue');
  });
  document.getElementById('btn-start')!.addEventListener('click', () => {
    callbacks.onStartGame();
  });

  addChatUI(callbacks);
}

/** Show the client lobby screen (waiting for host to start) */
export function showClientLobby(players: LobbyPlayer[], callbacks: LobbyUICallbacks): void {
  const el = getRoot();
  el.innerHTML = `
    <div style="text-align:center;max-width:480px;width:100%;padding:24px;">
      <h2 style="margin-bottom:16px;">🦄 Room Lobby</h2>

      <div id="player-list" style="margin-bottom:20px;"></div>

      <div style="margin-bottom:16px;">
        <label style="opacity:0.7;font-size:13px;margin-right:8px;">Your team:</label>
        <button id="btn-team-red" style="padding:8px 20px;border:2px solid ${RED_TEAM_COLOR};border-radius:6px 0 0 6px;background:transparent;color:${RED_TEAM_COLOR};cursor:pointer;font-weight:bold;">Red</button>
        <button id="btn-team-blue" style="padding:8px 20px;border:2px solid ${BLUE_TEAM_COLOR};border-radius:0 6px 6px 0;background:${BLUE_TEAM_COLOR};color:#fff;cursor:pointer;font-weight:bold;">Blue</button>
      </div>

      <p style="opacity:0.6;font-size:14px;">Waiting for host to start...</p>
      ${CHAT_HTML}
    </div>
  `;

  renderPlayerList(players);
  updateTeamButtons('blue');

  document.getElementById('btn-team-red')!.addEventListener('click', () => {
    callbacks.onTeamChange('red');
    updateTeamButtons('red');
  });
  document.getElementById('btn-team-blue')!.addEventListener('click', () => {
    callbacks.onTeamChange('blue');
    updateTeamButtons('blue');
  });

  addChatUI(callbacks);
}

/** Update the player list in whichever lobby screen is showing */
export function updateLobbyPlayers(players: LobbyPlayer[]): void {
  renderPlayerList(players);
  updateStartButton(players);
}

/** Remove the lobby UI */
export function hideLobby(): void {
  root?.remove();
  root = null;
}

/** Show a simple status message in the lobby area */
export function showLobbyStatus(text: string): void {
  const el = getRoot();
  el.innerHTML = `<p style="font-size:20px;opacity:0.8;">${text}</p>`;
}

// --- Internal helpers ---

function renderPlayerList(players: LobbyPlayer[]): void {
  const container = document.getElementById('player-list');
  if (!container) return;

  const redPlayers = players.filter((p) => p.team === 'red');
  const bluePlayers = players.filter((p) => p.team === 'blue');

  container.innerHTML = `
    <div style="display:flex;gap:16px;justify-content:center;">
      <div style="flex:1;background:rgba(230,57,70,0.15);border-radius:8px;padding:12px;min-height:80px;">
        <div style="font-weight:bold;color:${RED_TEAM_COLOR};margin-bottom:8px;font-size:14px;">
          🔴 Red (${redPlayers.length})
        </div>
        ${redPlayers.map((p) => `<div style="padding:3px 0;font-size:13px;">🦄 ${escapeHtml(p.name)}</div>`).join('')}
      </div>
      <div style="flex:1;background:rgba(69,123,157,0.15);border-radius:8px;padding:12px;min-height:80px;">
        <div style="font-weight:bold;color:${BLUE_TEAM_COLOR};margin-bottom:8px;font-size:14px;">
          🔵 Blue (${bluePlayers.length})
        </div>
        ${bluePlayers.map((p) => `<div style="padding:3px 0;font-size:13px;">🦄 ${escapeHtml(p.name)}</div>`).join('')}
      </div>
    </div>
  `;
}

function updateTeamButtons(selected: Team): void {
  const redBtn = document.getElementById('btn-team-red') as HTMLButtonElement | null;
  const blueBtn = document.getElementById('btn-team-blue') as HTMLButtonElement | null;
  if (!redBtn || !blueBtn) return;

  if (selected === 'red') {
    redBtn.style.background = RED_TEAM_COLOR;
    redBtn.style.color = '#fff';
    blueBtn.style.background = 'transparent';
    blueBtn.style.color = BLUE_TEAM_COLOR;
  } else {
    redBtn.style.background = 'transparent';
    redBtn.style.color = RED_TEAM_COLOR;
    blueBtn.style.background = BLUE_TEAM_COLOR;
    blueBtn.style.color = '#fff';
  }
}

function updateStartButton(players: LobbyPlayer[]): void {
  const btn = document.getElementById('btn-start') as HTMLButtonElement | null;
  const hint = document.getElementById('start-hint');
  if (!btn) return;

  const hasRed = players.some((p) => p.team === 'red');
  const hasBlue = players.some((p) => p.team === 'blue');
  const canStart = hasRed && hasBlue;

  btn.disabled = !canStart;
  btn.style.opacity = canStart ? '1' : '0.4';
  if (hint) hint.style.display = canStart ? 'none' : 'block';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const CHAT_HTML = `
  <div id="lobby-chat" style="margin-top:16px;text-align:left;">
    <div id="chat-messages" style="height:120px;overflow-y:auto;background:rgba(0,0,0,0.3);border-radius:6px;padding:8px;font-size:13px;margin-bottom:8px;"></div>
    <div style="display:flex;gap:6px;">
      <input id="chat-input" type="text" maxlength="100" placeholder="Type a message..."
        style="flex:1;padding:8px;font-size:13px;border-radius:6px;border:1px solid #444;background:#2a2a4a;color:#fff;">
      <button id="btn-chat-send" style="padding:8px 16px;border:none;border-radius:6px;background:#457b9d;color:#fff;cursor:pointer;font-weight:bold;">Send</button>
    </div>
  </div>
`;

function addChatUI(callbacks: LobbyUICallbacks): void {
  const input = document.getElementById('chat-input') as HTMLInputElement | null;
  const btn = document.getElementById('btn-chat-send');
  if (!input || !btn) return;

  const send = () => {
    const text = input.value.trim();
    if (text && callbacks.onChat) {
      callbacks.onChat(text);
      input.value = '';
    }
  };

  btn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
  });
}

/** Append a chat message to the lobby chat box */
export function appendChatMessage(name: string, text: string): void {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const msg = document.createElement('div');
  msg.style.cssText = 'padding:2px 0;word-break:break-word;';
  msg.innerHTML = `<strong style="color:#74c0fc;">${escapeHtml(name)}:</strong> ${escapeHtml(text)}`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}
