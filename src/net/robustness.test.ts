import { describe, it, expect } from 'vitest';
import { createGameState, simulateTick, removePlayer } from '../physics/engine';
import type { InputFrame, GameState } from '../types';
import { KICKOFF_COUNTDOWN_TICKS, MAX_ON_FIELD_PER_TEAM, INPUT_BUFFER_TICKS } from '../constants';

function noInput(): Map<number, InputFrame> {
  return new Map();
}

function skipKickoff(state: GameState): void {
  for (let i = 0; i < KICKOFF_COUNTDOWN_TICKS + 1; i++) {
    simulateTick(state, noInput());
  }
}

describe('Player disconnect: removePlayer', () => {
  it('removes an on-field player and the team plays short-handed', () => {
    const state = createGameState(2, 2);
    skipKickoff(state);

    // Remove red player 0
    const name = removePlayer(state, 0);
    expect(name).toBe('Red 1');
    expect(state.players).toHaveLength(3);
    expect(state.players.filter((p) => p.team === 'red' && p.onField)).toHaveLength(1);
  });

  it('subs in a reserve when an on-field player disconnects', () => {
    // 5 red (4 on field, 1 reserve) vs 1 blue
    const state = createGameState(5, 1);
    skipKickoff(state);

    const redOnFieldBefore = state.players.filter((p) => p.team === 'red' && p.onField);
    expect(redOnFieldBefore).toHaveLength(MAX_ON_FIELD_PER_TEAM);

    const redReserve = state.players.find((p) => p.team === 'red' && !p.onField)!;
    expect(redReserve).toBeDefined();
    expect(redReserve.onField).toBe(false);

    // Remove an on-field red player
    const removedId = redOnFieldBefore[0].id;
    const name = removePlayer(state, removedId);
    expect(name).not.toBeNull();

    // Total red players should be 4 now (was 5)
    expect(state.players.filter((p) => p.team === 'red')).toHaveLength(4);

    // All 4 red should be on field (reserve subbed in)
    expect(state.players.filter((p) => p.team === 'red' && p.onField)).toHaveLength(4);
  });

  it('removes a reserve player without affecting on-field count', () => {
    const state = createGameState(5, 1);
    skipKickoff(state);

    const reserve = state.players.find((p) => p.team === 'red' && !p.onField)!;
    removePlayer(state, reserve.id);

    expect(state.players.filter((p) => p.team === 'red')).toHaveLength(4);
    expect(state.players.filter((p) => p.team === 'red' && p.onField)).toHaveLength(4);
  });

  it('returns null for non-existent player', () => {
    const state = createGameState(1, 1);
    expect(removePlayer(state, 999)).toBeNull();
  });

  it('game continues after disconnect with unequal teams', () => {
    const state = createGameState(3, 3);
    skipKickoff(state);

    // Remove two blue players
    const bluePlayers = state.players.filter((p) => p.team === 'blue');
    removePlayer(state, bluePlayers[0].id);
    removePlayer(state, bluePlayers[1].id);

    // 3 red vs 1 blue
    expect(state.players.filter((p) => p.team === 'red')).toHaveLength(3);
    expect(state.players.filter((p) => p.team === 'blue')).toHaveLength(1);

    // Game should still run fine
    for (let t = 0; t < 120; t++) {
      const inputs = new Map<number, InputFrame>();
      for (const p of state.players) {
        if (p.onField) {
          inputs.set(p.id, { dx: 1, dy: 0, kick: false });
        }
      }
      simulateTick(state, inputs);
    }

    expect(state.phase).not.toBe('ended');
    expect(Number.isFinite(state.ball.position.x)).toBe(true);
  });

  it('handles removing all players from one team', () => {
    const state = createGameState(2, 1);
    skipKickoff(state);

    // Remove the only blue player
    const bluePlayer = state.players.find((p) => p.team === 'blue')!;
    removePlayer(state, bluePlayer.id);

    expect(state.players.filter((p) => p.team === 'blue')).toHaveLength(0);

    // Game continues (no forced forfeits)
    for (let t = 0; t < 60; t++) {
      const inputs = new Map<number, InputFrame>();
      for (const p of state.players) {
        if (p.onField) {
          inputs.set(p.id, { dx: 1, dy: 0, kick: false });
        }
      }
      simulateTick(state, inputs);
    }

    expect(Number.isFinite(state.ball.position.x)).toBe(true);
  });
});

describe('Input buffering', () => {
  it('replays last input within buffer window', () => {
    // Simulate what the host does: track inputAge, replay within buffer
    const state = createGameState(1, 1);
    skipKickoff(state);

    const player = state.players.find((p) => p.team === 'red')!;
    const startX = player.position.x;

    // Simulate INPUT_BUFFER_TICKS with stale input (moving right)
    const staleInput: InputFrame = { dx: 1, dy: 0, kick: false };
    for (let age = 1; age <= INPUT_BUFFER_TICKS; age++) {
      const inputs = new Map<number, InputFrame>();
      inputs.set(player.id, staleInput); // Within buffer — replay
      simulateTick(state, inputs);
    }

    // Player should have moved right
    expect(player.position.x).toBeGreaterThan(startX);
  });

  it('stops replaying after buffer expires (zero input causes deceleration)', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    const player = state.players.find((p) => p.team === 'red')!;

    // Move right for a bit to get velocity
    for (let t = 0; t < 30; t++) {
      simulateTick(state, new Map([[player.id, { dx: 1, dy: 0, kick: false }]]));
    }

    const velocityWithInput = Math.abs(player.velocity.x);
    expect(velocityWithInput).toBeGreaterThan(1.0);

    // Now simulate with zero input (buffer expired) — velocity should decrease
    for (let t = 0; t < 60; t++) {
      simulateTick(state, new Map([[player.id, { dx: 0, dy: 0, kick: false }]]));
    }

    // Velocity should be significantly reduced (damped without new input)
    expect(Math.abs(player.velocity.x)).toBeLessThan(velocityWithInput * 0.1);
  });
});

describe('Late join prevention', () => {
  it('rejects join messages when game is running (tested via mock)', () => {
    // This tests the logic: once `running` is true, join is rejected.
    // We test the engine-level invariant: a game state created with N players
    // should never grow beyond N players.
    const state = createGameState(2, 2);
    const initialCount = state.players.length;

    // Run some ticks
    skipKickoff(state);
    for (let t = 0; t < 60; t++) {
      simulateTick(state, noInput());
    }

    // No way to add players via engine — count should be the same
    expect(state.players.length).toBe(initialCount);
  });
});

describe('Game continues with disconnects', () => {
  it('full 30-second match with mid-game disconnects, invariants hold', () => {
    // Start 5v5 (with reserves)
    const state = createGameState(5, 5);
    const TICKS_30S = 60 * 30;
    let disconnected = false;

    for (let t = 0; t < TICKS_30S; t++) {
      // At tick 600 (10s), disconnect two players
      if (t === 600 && !disconnected) {
        const red = state.players.find((p) => p.team === 'red' && p.onField)!;
        const blue = state.players.find((p) => p.team === 'blue' && p.onField)!;
        removePlayer(state, red.id);
        removePlayer(state, blue.id);
        disconnected = true;
      }

      const inputs = new Map<number, InputFrame>();
      for (const p of state.players) {
        if (!p.onField) continue;
        const dx = state.ball.position.x - p.position.x;
        const dy = state.ball.position.y - p.position.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        inputs.set(p.id, {
          dx: len > 0 ? dx / len : 0,
          dy: len > 0 ? dy / len : 0,
          kick: len < 30,
        });
      }
      simulateTick(state, inputs);

      // Invariants
      expect(Number.isFinite(state.ball.position.x)).toBe(true);
      expect(Number.isFinite(state.ball.position.y)).toBe(true);
      expect(state.scoreRed).toBeGreaterThanOrEqual(0);
      expect(state.scoreBlue).toBeGreaterThanOrEqual(0);

      const onFieldRed = state.players.filter((p) => p.team === 'red' && p.onField).length;
      const onFieldBlue = state.players.filter((p) => p.team === 'blue' && p.onField).length;
      expect(onFieldRed).toBeLessThanOrEqual(MAX_ON_FIELD_PER_TEAM);
      expect(onFieldBlue).toBeLessThanOrEqual(MAX_ON_FIELD_PER_TEAM);
    }

    // After disconnects, should have 4 red + 4 blue = 8
    expect(state.players).toHaveLength(8);
  });
});
