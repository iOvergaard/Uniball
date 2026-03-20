import Peer, { type DataConnection } from 'peerjs';
import { TICK_RATE, TICK_DURATION, STATE_BROADCAST_RATE } from '../constants';
import { createGameState, simulateTick } from '../physics/engine';
import { encodeState } from './protocol';
import { decodeInput } from './protocol';
import type {
  GameState,
  InputFrame,
  LobbyPlayer,
  LobbyMessage,
  StateSnapshot,
  Team,
} from '../types';

export interface HostCallbacks {
  onReady: (peerId: string) => void;
  onPlayerJoin: (player: LobbyPlayer) => void;
  onPlayerLeave: (playerId: number) => void;
  onGameStart: (state: GameState) => void;
  onTick: (state: GameState) => void;
}

interface ConnectedClient {
  conn: DataConnection;
  playerId: number;
  name: string;
  team: Team;
  lastInput: InputFrame;
}

export class GameHost {
  private peer: Peer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private nextPlayerId = 1; // 0 is reserved for the host player
  private state: GameState | null = null;
  private running = false;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private broadcastSeq = 0;
  private broadcastCounter = 0;
  private readonly broadcastEveryNTicks = Math.round(TICK_RATE / STATE_BROADCAST_RATE);

  // Host player info
  private hostTeam: Team = 'red';
  private hostName = 'Host';
  private hostInput: InputFrame = { dx: 0, dy: 0, kick: false };

  constructor(private callbacks: HostCallbacks) {}

  async start(): Promise<void> {
    this.peer = new Peer();
    return new Promise((resolve, reject) => {
      this.peer!.on('open', (id) => {
        this.callbacks.onReady(id);
        this.peer!.on('connection', (conn) => this.handleConnection(conn));
        resolve();
      });
      this.peer!.on('error', (err) => reject(err));
    });
  }

  setHostTeam(team: Team): void {
    this.hostTeam = team;
  }

  setHostName(name: string): void {
    this.hostName = name;
  }

  setHostInput(input: InputFrame): void {
    this.hostInput = input;
  }

  getState(): GameState | null {
    return this.state;
  }

  getLobbyPlayers(): LobbyPlayer[] {
    const players: LobbyPlayer[] = [{ id: 0, name: this.hostName, team: this.hostTeam }];
    for (const client of this.clients.values()) {
      players.push({ id: client.playerId, name: client.name, team: client.team });
    }
    return players;
  }

  private handleConnection(conn: DataConnection): void {
    conn.on('open', () => {
      // Set up reliable channel for lobby messages
      conn.on('data', (data) => {
        if (data instanceof ArrayBuffer) {
          this.handleBinaryMessage(conn, data);
        } else {
          this.handleLobbyMessage(conn, data as LobbyMessage);
        }
      });

      conn.on('close', () => {
        const client = this.clients.get(conn.peer);
        if (client) {
          this.clients.delete(conn.peer);
          this.callbacks.onPlayerLeave(client.playerId);
          this.broadcastPlayerList();
        }
      });
    });
  }

  private handleLobbyMessage(conn: DataConnection, msg: LobbyMessage): void {
    switch (msg.type) {
      case 'join': {
        const playerId = this.nextPlayerId++;
        const client: ConnectedClient = {
          conn,
          playerId,
          name: msg.name,
          team: 'blue', // Default new players to blue
          lastInput: { dx: 0, dy: 0, kick: false },
        };
        this.clients.set(conn.peer, client);

        // Send welcome with assigned ID
        const welcome: LobbyMessage = { type: 'welcome', playerId };
        conn.send(welcome);

        this.callbacks.onPlayerJoin({ id: playerId, name: msg.name, team: client.team });
        this.broadcastPlayerList();
        break;
      }
      case 'team': {
        const client = this.clients.get(conn.peer);
        if (client) {
          client.team = msg.team;
          this.broadcastPlayerList();
        }
        break;
      }
    }
  }

  private handleBinaryMessage(conn: DataConnection, data: ArrayBuffer): void {
    const client = this.clients.get(conn.peer);
    if (!client) return;

    const decoded = decodeInput(data);
    if (decoded) {
      client.lastInput = decoded.input;
    }
  }

  private broadcastPlayerList(): void {
    const players = this.getLobbyPlayers();
    const msg: LobbyMessage = { type: 'playerList', players };
    for (const client of this.clients.values()) {
      client.conn.send(msg);
    }
  }

  startGame(): void {
    if (this.running) return;

    // Count players per team
    const players = this.getLobbyPlayers();
    const redCount = players.filter((p) => p.team === 'red').length;
    const blueCount = players.filter((p) => p.team === 'blue').length;

    this.state = createGameState(redCount, blueCount);

    // Assign names to match lobby order
    const redPlayers = players.filter((p) => p.team === 'red');
    const bluePlayers = players.filter((p) => p.team === 'blue');
    for (let i = 0; i < redCount; i++) {
      this.state.players[i].name = redPlayers[i].name;
    }
    for (let i = 0; i < blueCount; i++) {
      this.state.players[redCount + i].name = bluePlayers[i].name;
    }

    // Map lobby player IDs to game state player IDs
    // Build a mapping so we can route inputs correctly
    this.playerIdToStateIdx = new Map();
    for (let i = 0; i < redCount; i++) {
      this.playerIdToStateIdx.set(redPlayers[i].id, i);
    }
    for (let i = 0; i < blueCount; i++) {
      this.playerIdToStateIdx.set(bluePlayers[i].id, redCount + i);
    }

    // Notify clients
    const startMsg: LobbyMessage = { type: 'start' };
    for (const client of this.clients.values()) {
      client.conn.send(startMsg);
    }

    this.running = true;
    this.callbacks.onGameStart(this.state);

    // Start tick loop
    this.tickInterval = setInterval(() => this.tick(), TICK_DURATION);
  }

  private playerIdToStateIdx: Map<number, number> = new Map();

  private tick(): void {
    if (!this.state || !this.running) return;

    // Build input map: game-state player ID → InputFrame
    const inputs = new Map<number, InputFrame>();

    // Host input
    const hostIdx = this.playerIdToStateIdx.get(0);
    if (hostIdx !== undefined) {
      inputs.set(hostIdx, this.hostInput);
    }

    // Client inputs
    for (const client of this.clients.values()) {
      const idx = this.playerIdToStateIdx.get(client.playerId);
      if (idx !== undefined) {
        inputs.set(idx, client.lastInput);
      }
    }

    simulateTick(this.state, inputs);
    this.callbacks.onTick(this.state);

    // Broadcast state at reduced rate
    this.broadcastCounter++;
    if (this.broadcastCounter >= this.broadcastEveryNTicks) {
      this.broadcastCounter = 0;
      this.broadcastState();
    }

    if (this.state.phase === 'ended') {
      this.stop();
    }
  }

  private broadcastState(): void {
    if (!this.state) return;

    const snapshot: StateSnapshot = {
      tick: this.state.tick,
      matchTime: this.state.matchTime,
      phase: this.state.phase,
      kickoffCountdown: this.state.kickoffCountdown,
      scoreRed: this.state.scoreRed,
      scoreBlue: this.state.scoreBlue,
      halfSwapped: this.state.halfSwapped,
      lastSubstitutionTime: this.state.lastSubstitutionTime,
      players: this.state.players,
      ball: this.state.ball,
      timestamp: performance.now(),
    };

    const buf = encodeState(this.broadcastSeq++, snapshot);
    for (const client of this.clients.values()) {
      client.conn.send(buf);
    }
  }

  stop(): void {
    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  destroy(): void {
    this.stop();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
