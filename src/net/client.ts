import Peer, { type DataConnection } from 'peerjs';
import { INTERPOLATION_BUFFER_MS } from '../constants';
import { encodeInput, decodeState } from './protocol';
import { vec2Lerp } from '../util/math';
import type { GameState, InputFrame, LobbyPlayer, LobbyMessage, StateSnapshot } from '../types';

export interface ClientCallbacks {
  onConnected: () => void;
  onWelcome: (playerId: number) => void;
  onPlayerList: (players: LobbyPlayer[]) => void;
  onGameStart: () => void;
  onStateUpdate: (state: GameState) => void;
  onDisconnect: () => void;
}

export class GameClient {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private inputSeq = 0;
  private playerId = -1;

  // Interpolation buffer: keep recent snapshots sorted by timestamp
  private snapshots: StateSnapshot[] = [];
  private renderState: GameState | null = null;
  private playerNames: Record<number, string> = {};

  constructor(private callbacks: ClientCallbacks) {}

  async connect(hostPeerId: string): Promise<void> {
    this.peer = new Peer();
    return new Promise((resolve, reject) => {
      this.peer!.on('open', () => {
        this.conn = this.peer!.connect(hostPeerId, { reliable: true });

        this.conn.on('open', () => {
          this.callbacks.onConnected();

          this.conn!.on('data', (data) => {
            if (data instanceof ArrayBuffer) {
              this.handleBinaryMessage(data);
            } else {
              this.handleLobbyMessage(data as LobbyMessage);
            }
          });

          this.conn!.on('close', () => {
            this.callbacks.onDisconnect();
          });

          resolve();
        });

        this.conn.on('error', (err) => reject(err));
      });

      this.peer!.on('error', (err) => reject(err));
    });
  }

  join(name: string): void {
    const msg: LobbyMessage = { type: 'join', name };
    this.conn?.send(msg);
  }

  setTeam(team: 'red' | 'blue'): void {
    const msg: LobbyMessage = { type: 'team', team };
    this.conn?.send(msg);
  }

  sendInput(input: InputFrame): void {
    if (!this.conn) return;
    const buf = encodeInput(this.inputSeq++, input);
    this.conn.send(buf);
  }

  getPlayerId(): number {
    return this.playerId;
  }

  getState(): GameState | null {
    return this.renderState;
  }

  private handleLobbyMessage(msg: LobbyMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.callbacks.onWelcome(msg.playerId);
        break;
      case 'playerList':
        this.callbacks.onPlayerList(msg.players);
        break;
      case 'start':
        this.playerNames = msg.playerNames;
        this.callbacks.onGameStart();
        break;
    }
  }

  private handleBinaryMessage(data: ArrayBuffer): void {
    const decoded = decodeState(data);
    if (!decoded) return;

    decoded.snapshot.timestamp = performance.now();
    this.snapshots.push(decoded.snapshot);

    // Keep only the last 10 snapshots
    if (this.snapshots.length > 10) {
      this.snapshots.shift();
    }

    // Update render state via interpolation
    this.interpolate();
  }

  /** Interpolate between two recent snapshots for smooth rendering */
  interpolate(): void {
    if (this.snapshots.length === 0) return;

    // If we only have one snapshot, use it directly
    if (this.snapshots.length < 2) {
      this.renderState = this.snapshotToGameState(this.snapshots[0]);
      this.callbacks.onStateUpdate(this.renderState);
      return;
    }

    // Render time is current time minus buffer delay
    const renderTime = performance.now() - INTERPOLATION_BUFFER_MS;

    // Find the two snapshots to interpolate between
    let from: StateSnapshot | null = null;
    let to: StateSnapshot | null = null;

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      if (
        this.snapshots[i].timestamp <= renderTime &&
        this.snapshots[i + 1].timestamp >= renderTime
      ) {
        from = this.snapshots[i];
        to = this.snapshots[i + 1];
        break;
      }
    }

    // If render time is ahead of all snapshots, use the latest
    if (!from || !to) {
      this.renderState = this.snapshotToGameState(this.snapshots[this.snapshots.length - 1]);
      this.callbacks.onStateUpdate(this.renderState);
      return;
    }

    // Calculate interpolation factor
    const range = to.timestamp - from.timestamp;
    const t = range > 0 ? (renderTime - from.timestamp) / range : 1;

    this.renderState = this.interpolateSnapshots(from, to, t);
    this.callbacks.onStateUpdate(this.renderState);
  }

  private applyNames(players: StateSnapshot['players']): StateSnapshot['players'] {
    return players.map((p) => ({
      ...p,
      name: this.playerNames[p.id] ?? p.name,
    }));
  }

  private snapshotToGameState(snap: StateSnapshot): GameState {
    return {
      tick: snap.tick,
      matchTime: snap.matchTime,
      phase: snap.phase,
      kickoffCountdown: snap.kickoffCountdown,
      scoreRed: snap.scoreRed,
      scoreBlue: snap.scoreBlue,
      players: this.applyNames(snap.players),
      ball: snap.ball,
      halfSwapped: snap.halfSwapped,
      lastSubstitutionTime: snap.lastSubstitutionTime,
    };
  }

  private interpolateSnapshots(from: StateSnapshot, to: StateSnapshot, t: number): GameState {
    // Interpolate positions, use latest for discrete values
    const players = to.players.map((toPlayer) => {
      const fromPlayer = from.players.find((p) => p.id === toPlayer.id);
      if (!fromPlayer) return toPlayer;

      return {
        ...toPlayer,
        position: vec2Lerp(fromPlayer.position, toPlayer.position, t),
        velocity: vec2Lerp(fromPlayer.velocity, toPlayer.velocity, t),
      };
    });

    const ball = {
      position: vec2Lerp(from.ball.position, to.ball.position, t),
      velocity: vec2Lerp(from.ball.velocity, to.ball.velocity, t),
    };

    return {
      tick: to.tick,
      matchTime: to.matchTime,
      phase: to.phase,
      kickoffCountdown: to.kickoffCountdown,
      scoreRed: to.scoreRed,
      scoreBlue: to.scoreBlue,
      players: this.applyNames(players),
      ball,
      halfSwapped: to.halfSwapped,
      lastSubstitutionTime: to.lastSubstitutionTime,
    };
  }

  destroy(): void {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
