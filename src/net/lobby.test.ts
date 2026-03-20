import { describe, it, expect } from 'vitest';
import { createGameState, simulateTick } from '../physics/engine';
import { encodeInput, decodeInput, encodeState, decodeState } from './protocol';
import type { InputFrame, LobbyPlayer, StateSnapshot, Team } from '../types';

/**
 * Phase 4 tests: Lobby + Multi-Player
 *
 * These tests simulate the full lobby→game flow using in-memory message passing
 * (no real PeerJS). We test:
 * - Multiple clients joining and picking teams
 * - Host starting a match with correct player assignment
 * - Full multi-player game simulation with 4+ players
 * - State broadcast round-trip through binary protocol
 * - Substitution with network players
 */

// --- In-memory host simulation (mirrors GameHost logic without PeerJS) ---

interface MockClient {
  id: number;
  name: string;
  team: Team;
  lastInput: InputFrame;
}

function createMockLobby(): {
  clients: MockClient[];
  addClient: (name: string, team: Team) => MockClient;
  startGame: () => { state: GameState; playerMap: Map<number, number> };
} {
  let nextId = 1; // 0 = host
  const clients: MockClient[] = [];

  return {
    clients,
    addClient(name: string, team: Team): MockClient {
      const client: MockClient = {
        id: nextId++,
        name,
        team,
        lastInput: { dx: 0, dy: 0, kick: false },
      };
      clients.push(client);
      return client;
    },
    startGame(): { state: GameState; playerMap: Map<number, number> } {
      // Include host as player 0
      const allPlayers: LobbyPlayer[] = [
        { id: 0, name: 'Host', team: 'red' },
        ...clients.map((c) => ({ id: c.id, name: c.name, team: c.team })),
      ];

      const redPlayers = allPlayers.filter((p) => p.team === 'red');
      const bluePlayers = allPlayers.filter((p) => p.team === 'blue');

      const state = createGameState(redPlayers.length, bluePlayers.length);

      // Assign names
      for (let i = 0; i < redPlayers.length; i++) {
        state.players[i].name = redPlayers[i].name;
      }
      for (let i = 0; i < bluePlayers.length; i++) {
        state.players[redPlayers.length + i].name = bluePlayers[i].name;
      }

      // Build ID→index mapping
      const playerMap = new Map<number, number>();
      for (let i = 0; i < redPlayers.length; i++) {
        playerMap.set(redPlayers[i].id, i);
      }
      for (let i = 0; i < bluePlayers.length; i++) {
        playerMap.set(bluePlayers[i].id, redPlayers.length + i);
      }

      return { state, playerMap };
    },
  };
}

describe('Lobby: player management', () => {
  it('assigns unique IDs to clients', () => {
    const lobby = createMockLobby();
    const c1 = lobby.addClient('Alice', 'red');
    const c2 = lobby.addClient('Bob', 'blue');
    const c3 = lobby.addClient('Charlie', 'red');

    expect(c1.id).toBe(1);
    expect(c2.id).toBe(2);
    expect(c3.id).toBe(3);
    expect(new Set([c1.id, c2.id, c3.id]).size).toBe(3);
  });

  it('tracks team assignments', () => {
    const lobby = createMockLobby();
    lobby.addClient('Alice', 'red');
    lobby.addClient('Bob', 'blue');
    lobby.addClient('Charlie', 'blue');

    const red = lobby.clients.filter((c) => c.team === 'red');
    const blue = lobby.clients.filter((c) => c.team === 'blue');
    expect(red).toHaveLength(1);
    expect(blue).toHaveLength(2);
  });

  it('allows team switching before game starts', () => {
    const lobby = createMockLobby();
    const c1 = lobby.addClient('Alice', 'red');
    expect(c1.team).toBe('red');
    c1.team = 'blue';
    expect(c1.team).toBe('blue');
  });
});

describe('Lobby: game start', () => {
  it('creates game state with correct player counts', () => {
    const lobby = createMockLobby();
    lobby.addClient('Alice', 'blue');
    lobby.addClient('Bob', 'blue');
    // Host is red, Alice and Bob are blue → 1 red, 2 blue
    const { state } = lobby.startGame();

    expect(state.players.filter((p) => p.team === 'red')).toHaveLength(1);
    expect(state.players.filter((p) => p.team === 'blue')).toHaveLength(2);
  });

  it('assigns correct names from lobby', () => {
    const lobby = createMockLobby();
    lobby.addClient('Alice', 'red');
    lobby.addClient('Bob', 'blue');
    const { state } = lobby.startGame();

    const names = state.players.map((p) => p.name);
    expect(names).toContain('Host');
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('maps lobby IDs to game state indices', () => {
    const lobby = createMockLobby();
    lobby.addClient('Alice', 'red');
    lobby.addClient('Bob', 'blue');
    const { playerMap } = lobby.startGame();

    // Host (id=0) is first red player → index 0
    expect(playerMap.get(0)).toBe(0);
    // Alice (id=1) is second red player → index 1
    expect(playerMap.get(1)).toBe(1);
    // Bob (id=2) is first blue player → index 2
    expect(playerMap.get(2)).toBe(2);
  });
});

describe('Multi-player game simulation (4+ players)', () => {
  it('runs a 4-player match (2v2) with correct inputs routed', () => {
    const lobby = createMockLobby();
    lobby.addClient('Alice', 'red'); // id=1
    lobby.addClient('Bob', 'blue'); // id=2
    lobby.addClient('Charlie', 'blue'); // id=3

    const { state, playerMap } = lobby.startGame();
    // Host(0)=red, Alice(1)=red, Bob(2)=blue, Charlie(3)=blue → 2v2

    expect(state.players).toHaveLength(4);
    expect(state.players.filter((p) => p.team === 'red')).toHaveLength(2);
    expect(state.players.filter((p) => p.team === 'blue')).toHaveLength(2);

    // Simulate 240 ticks (4 seconds — past 3s kickoff countdown) with all players moving
    for (let t = 0; t < 240; t++) {
      const inputs = new Map<number, InputFrame>();
      inputs.set(playerMap.get(0)!, { dx: 1, dy: 0, kick: false });
      inputs.set(playerMap.get(1)!, { dx: 1, dy: 0, kick: false });
      inputs.set(playerMap.get(2)!, { dx: -1, dy: 0, kick: false });
      inputs.set(playerMap.get(3)!, { dx: -1, dy: 0, kick: false });
      simulateTick(state, inputs);
    }

    // After kickoff countdown, players should have non-zero velocity
    const onField = state.players.filter((p) => p.onField);
    const moving = onField.filter((p) => Math.abs(p.velocity.x) > 0.01);
    expect(moving.length).toBeGreaterThan(0);
  });

  it('runs a 6-player match with reserves (3v3 with 4 per team max = all on field)', () => {
    const lobby = createMockLobby();
    // Host = red, add 2 more red and 3 blue = 3v3
    lobby.addClient('R2', 'red');
    lobby.addClient('R3', 'red');
    lobby.addClient('B1', 'blue');
    lobby.addClient('B2', 'blue');
    lobby.addClient('B3', 'blue');

    const { state, playerMap } = lobby.startGame();
    expect(state.players).toHaveLength(6);

    // All 6 should be on field (3 per team, under max 4)
    expect(state.players.filter((p) => p.onField)).toHaveLength(6);

    // Run 120 ticks
    for (let t = 0; t < 120; t++) {
      const inputs = new Map<number, InputFrame>();
      for (const [_lobbyId, stateIdx] of playerMap) {
        const team = state.players[stateIdx].team;
        inputs.set(stateIdx, {
          dx: team === 'red' ? 1 : -1,
          dy: Math.sin(t * 0.1) * 0.5,
          kick: t % 30 === 0,
        });
      }
      simulateTick(state, inputs);
    }

    expect(state.tick).toBe(120);
  });

  it('handles 8-player match with reserves (5 red + 3 blue)', () => {
    const lobby = createMockLobby();
    // Host = red, add 4 more red and 3 blue = 5v3
    lobby.addClient('R2', 'red');
    lobby.addClient('R3', 'red');
    lobby.addClient('R4', 'red');
    lobby.addClient('R5', 'red');
    lobby.addClient('B1', 'blue');
    lobby.addClient('B2', 'blue');
    lobby.addClient('B3', 'blue');

    const { state } = lobby.startGame();
    expect(state.players).toHaveLength(8);

    // Red has 5 players, max 4 on field → 1 reserve
    const redOnField = state.players.filter((p) => p.team === 'red' && p.onField).length;
    const redReserves = state.players.filter((p) => p.team === 'red' && !p.onField).length;
    expect(redOnField).toBe(4);
    expect(redReserves).toBe(1);

    // Blue has 3 → all on field
    expect(state.players.filter((p) => p.team === 'blue' && p.onField)).toHaveLength(3);
  });

  it('runs a full 30-second game simulation with 8 players, invariants hold', () => {
    const lobby = createMockLobby();
    lobby.addClient('R2', 'red');
    lobby.addClient('R3', 'red');
    lobby.addClient('R4', 'red');
    lobby.addClient('B1', 'blue');
    lobby.addClient('B2', 'blue');
    lobby.addClient('B3', 'blue');
    lobby.addClient('B4', 'blue');

    const { state, playerMap } = lobby.startGame();
    // 4 red (Host+R2+R3+R4) vs 4 blue (B1-B4) = 4v4, all on field
    expect(state.players).toHaveLength(8);

    const TICKS_30S = 60 * 30;
    for (let t = 0; t < TICKS_30S; t++) {
      const inputs = new Map<number, InputFrame>();
      for (const [_lobbyId, stateIdx] of playerMap) {
        // Simple chase-ball bot
        const p = state.players[stateIdx];
        if (!p.onField) continue;
        const dx = state.ball.position.x - p.position.x;
        const dy = state.ball.position.y - p.position.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        inputs.set(stateIdx, {
          dx: len > 0 ? dx / len : 0,
          dy: len > 0 ? dy / len : 0,
          kick: len < 30,
        });
      }
      simulateTick(state, inputs);

      // Invariants
      expect(state.tick).toBe(t + 1);
      expect(Number.isFinite(state.ball.position.x)).toBe(true);
      expect(Number.isFinite(state.ball.position.y)).toBe(true);
      expect(state.scoreRed).toBeGreaterThanOrEqual(0);
      expect(state.scoreBlue).toBeGreaterThanOrEqual(0);

      const onFieldRed = state.players.filter((p) => p.team === 'red' && p.onField).length;
      const onFieldBlue = state.players.filter((p) => p.team === 'blue' && p.onField).length;
      expect(onFieldRed).toBeLessThanOrEqual(4);
      expect(onFieldBlue).toBeLessThanOrEqual(4);
    }
  });
});

describe('State broadcast round-trip with network players', () => {
  it('encodes and decodes state for 8-player game', () => {
    const lobby = createMockLobby();
    for (let i = 0; i < 3; i++) lobby.addClient(`R${i + 2}`, 'red');
    for (let i = 0; i < 4; i++) lobby.addClient(`B${i + 1}`, 'blue');

    const { state, playerMap } = lobby.startGame();

    // Run a few ticks
    for (let t = 0; t < 10; t++) {
      const inputs = new Map<number, InputFrame>();
      for (const [_, stateIdx] of playerMap) {
        inputs.set(stateIdx, { dx: 1, dy: 0, kick: false });
      }
      simulateTick(state, inputs);
    }

    // Encode as snapshot
    const snapshot: StateSnapshot = {
      ...state,
      timestamp: 12345,
    };
    const buf = encodeState(99, snapshot);
    const decoded = decodeState(buf);

    expect(decoded).not.toBeNull();
    expect(decoded!.seq).toBe(99);
    expect(decoded!.snapshot.players).toHaveLength(8);
    expect(decoded!.snapshot.tick).toBe(10);
    expect(decoded!.snapshot.ball.position.x).toBeCloseTo(state.ball.position.x);

    // Verify all player positions made it through
    for (let i = 0; i < 8; i++) {
      expect(decoded!.snapshot.players[i].position.x).toBeCloseTo(state.players[i].position.x);
      expect(decoded!.snapshot.players[i].position.y).toBeCloseTo(state.players[i].position.y);
      expect(decoded!.snapshot.players[i].team).toBe(state.players[i].team);
    }
  });

  it('input round-trips correctly for each player', () => {
    // Simulate each player sending different inputs
    const inputs: InputFrame[] = [
      { dx: 1, dy: 0, kick: false },
      { dx: -1, dy: 0.5, kick: true },
      { dx: 0, dy: -1, kick: false },
      { dx: 0.7, dy: 0.7, kick: true },
    ];

    for (let i = 0; i < inputs.length; i++) {
      const buf = encodeInput(i, inputs[i]);
      const decoded = decodeInput(buf);
      expect(decoded).not.toBeNull();
      expect(decoded!.seq).toBe(i);
      expect(decoded!.input.dx).toBeCloseTo(inputs[i].dx);
      expect(decoded!.input.dy).toBeCloseTo(inputs[i].dy);
      expect(decoded!.input.kick).toBe(inputs[i].kick);
    }
  });
});

describe('Substitution with network players', () => {
  it('rotates reserves in a 10-player match (5v5) after substitution interval', () => {
    const lobby = createMockLobby();
    // Host=red, add 4 more red + 5 blue = 5v5
    for (let i = 0; i < 4; i++) lobby.addClient(`R${i + 2}`, 'red');
    for (let i = 0; i < 5; i++) lobby.addClient(`B${i + 1}`, 'blue');

    const { state, playerMap } = lobby.startGame();
    expect(state.players).toHaveLength(10);

    // 5 per team, max 4 on field → 1 reserve each
    expect(state.players.filter((p) => p.team === 'red' && !p.onField)).toHaveLength(1);
    expect(state.players.filter((p) => p.team === 'blue' && !p.onField)).toHaveLength(1);

    // Track who starts on bench
    const initialRedReserve = state.players.find((p) => p.team === 'red' && !p.onField)!;
    const initialBlueReserve = state.players.find((p) => p.team === 'blue' && !p.onField)!;

    // Run past substitution interval (60 seconds = 3600 ticks) + kickoff countdown
    const TICKS = 60 * 65; // 65 seconds to be safe
    for (let t = 0; t < TICKS; t++) {
      const inputs = new Map<number, InputFrame>();
      for (const [_, stateIdx] of playerMap) {
        inputs.set(stateIdx, { dx: 0, dy: 0, kick: false });
      }
      simulateTick(state, inputs);
    }

    // After substitution, the initial reserves should now be on field
    const redReserveNow = state.players.find((p) => p.id === initialRedReserve.id)!;
    const blueReserveNow = state.players.find((p) => p.id === initialBlueReserve.id)!;
    expect(redReserveNow.onField).toBe(true);
    expect(blueReserveNow.onField).toBe(true);

    // Someone else should be on the bench now
    expect(state.players.filter((p) => p.team === 'red' && !p.onField)).toHaveLength(1);
    expect(state.players.filter((p) => p.team === 'blue' && !p.onField)).toHaveLength(1);
  });
});
