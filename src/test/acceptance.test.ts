/**
 * Acceptance tests — full match simulations with scripted player behavior.
 *
 * These tests exercise the entire game engine end-to-end: physics, collisions,
 * scoring, timer, kickoff, halftime, substitutions, and game-over.
 *
 * Tests use short match durations (30s) to keep CI fast.
 */
import { describe, it, expect } from 'vitest';
import { createGameState, simulateTick } from '../physics/engine';
import { GameState, InputFrame, PlayerState } from '../types';
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  TICK_RATE,
  KICKOFF_COUNTDOWN_TICKS,
  PLAYER_RADIUS,
  BALL_RADIUS,
  MAX_ON_FIELD_PER_TEAM,
  SUBSTITUTION_INTERVAL_SECONDS,
  KICK_RANGE,
  HALFTIME_SECONDS,
} from '../constants';

/** Short match duration for fast tests (30 seconds). */
const SHORT_MATCH_SECONDS = 30;

// ---------------------------------------------------------------------------
// Bot strategies
// ---------------------------------------------------------------------------

function chaseBallInput(player: PlayerState, state: GameState): InputFrame {
  const dx = state.ball.position.x - player.position.x;
  const dy = state.ball.position.y - player.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { dx: 0, dy: 0, kick: true };
  return { dx: dx / dist, dy: dy / dist, kick: dist < KICK_RANGE + 5 };
}

function attackInput(player: PlayerState, state: GameState): InputFrame {
  const targetX = player.team === 'red' ? FIELD_WIDTH : 0;
  const toBall = {
    x: state.ball.position.x - player.position.x,
    y: state.ball.position.y - player.position.y,
  };
  const distToBall = Math.hypot(toBall.x, toBall.y);

  if (distToBall < KICK_RANGE + 10) {
    return {
      dx: distToBall > 0 ? toBall.x / distToBall : 0,
      dy: distToBall > 0 ? toBall.y / distToBall : 0,
      kick: true,
    };
  }

  const biasX = (targetX - player.position.x) * 0.1;
  const mx = toBall.x + biasX;
  const my = toBall.y;
  const md = Math.hypot(mx, my);
  return { dx: md > 0 ? mx / md : 0, dy: md > 0 ? my / md : 0, kick: false };
}

function allPlayersInput(
  state: GameState,
  strategy: (player: PlayerState, state: GameState) => InputFrame,
): Map<number, InputFrame> {
  const inputs = new Map<number, InputFrame>();
  for (const p of state.players) {
    if (p.onField) inputs.set(p.id, strategy(p, state));
  }
  return inputs;
}

// ---------------------------------------------------------------------------
// Invariant checks (run every tick)
// ---------------------------------------------------------------------------

function assertInvariants(state: GameState, tick: number): void {
  const ctx = `tick ${tick}`;

  // All values must be finite
  for (const p of state.players) {
    expect(Number.isFinite(p.position.x), `${ctx}: player ${p.id} pos.x`).toBe(true);
    expect(Number.isFinite(p.position.y), `${ctx}: player ${p.id} pos.y`).toBe(true);
    expect(Number.isFinite(p.velocity.x), `${ctx}: player ${p.id} vel.x`).toBe(true);
    expect(Number.isFinite(p.velocity.y), `${ctx}: player ${p.id} vel.y`).toBe(true);
  }
  expect(Number.isFinite(state.ball.position.x), `${ctx}: ball pos.x`).toBe(true);
  expect(Number.isFinite(state.ball.position.y), `${ctx}: ball pos.y`).toBe(true);

  // On-field players within bounds
  const tol = PLAYER_RADIUS + 5;
  for (const p of state.players.filter((p) => p.onField)) {
    expect(p.position.x, `${ctx}: player ${p.id} off left`).toBeGreaterThanOrEqual(-tol);
    expect(p.position.x, `${ctx}: player ${p.id} off right`).toBeLessThanOrEqual(FIELD_WIDTH + tol);
    expect(p.position.y, `${ctx}: player ${p.id} off top`).toBeGreaterThanOrEqual(-tol);
    expect(p.position.y, `${ctx}: player ${p.id} off bottom`).toBeLessThanOrEqual(
      FIELD_HEIGHT + tol,
    );
  }

  // Team on-field limits
  const redOnField = state.players.filter((p) => p.team === 'red' && p.onField).length;
  const blueOnField = state.players.filter((p) => p.team === 'blue' && p.onField).length;
  expect(redOnField, `${ctx}: too many red`).toBeLessThanOrEqual(MAX_ON_FIELD_PER_TEAM);
  expect(blueOnField, `${ctx}: too many blue`).toBeLessThanOrEqual(MAX_ON_FIELD_PER_TEAM);

  // Non-negative values
  expect(state.scoreRed, `${ctx}: negative red score`).toBeGreaterThanOrEqual(0);
  expect(state.scoreBlue, `${ctx}: negative blue score`).toBeGreaterThanOrEqual(0);
  expect(state.matchTime, `${ctx}: negative match time`).toBeGreaterThanOrEqual(0);
}

// ---------------------------------------------------------------------------
// Match runner
// ---------------------------------------------------------------------------

function createShortGame(redCount: number, blueCount: number, durationSeconds: number): GameState {
  const state = createGameState(redCount, blueCount);
  state.matchTime = durationSeconds;
  state.lastSubstitutionTime = durationSeconds;
  return state;
}

function simulateMatch(
  redCount: number,
  blueCount: number,
  strategy: (player: PlayerState, state: GameState) => InputFrame,
  durationSeconds: number = SHORT_MATCH_SECONDS,
): GameState {
  const state = createShortGame(redCount, blueCount, durationSeconds);
  const totalPlayers = state.players.length;
  const maxTicks = Math.ceil(durationSeconds * TICK_RATE) + KICKOFF_COUNTDOWN_TICKS * 100;
  let tickCount = 0;

  while (state.phase !== 'ended' && tickCount < maxTicks) {
    const inputs = allPlayersInput(state, strategy);
    simulateTick(state, inputs);
    tickCount++;
    assertInvariants(state, tickCount);
    expect(state.players, `tick ${tickCount}: player count changed`).toHaveLength(totalPlayers);
  }

  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Acceptance: Full Match Simulation', () => {
  it('1v1 match completes with chase-ball bots', () => {
    const state = simulateMatch(1, 1, chaseBallInput);
    expect(state.phase).toBe('ended');
    expect(state.matchTime).toBe(0);
  });

  it('3v3 match completes with attacker bots', () => {
    const state = simulateMatch(3, 3, attackInput);
    expect(state.phase).toBe('ended');
    expect(state.matchTime).toBe(0);
  });

  it('3v3 with 1 reserve per team completes', () => {
    // 3 players per team, MAX_ON_FIELD_PER_TEAM=4 so all 3 are on field.
    // Use 5 per team to get reserves: 4 on field + 1 reserve.
    const state = simulateMatch(5, 5, attackInput);
    expect(state.phase).toBe('ended');
    expect(state.players).toHaveLength(10);
  });

  it('unequal teams (3v1) match completes', () => {
    const state = simulateMatch(3, 1, chaseBallInput);
    expect(state.phase).toBe('ended');
    expect(state.players.filter((p) => p.team === 'red')).toHaveLength(3);
    expect(state.players.filter((p) => p.team === 'blue')).toHaveLength(1);
  });

  it('goals are scored during active play', () => {
    const state = simulateMatch(2, 2, attackInput);
    const totalGoals = state.scoreRed + state.scoreBlue;
    expect(totalGoals).toBeGreaterThan(0);
  });
});

describe('Acceptance: Halftime', () => {
  it('halftime triggers and swaps sides', () => {
    // Start just above HALFTIME_SECONDS so halftime triggers within ~20s
    const startTime = HALFTIME_SECONDS + 20;
    const state = createShortGame(2, 2, startTime);
    const maxTicks = Math.ceil(startTime * TICK_RATE) + KICKOFF_COUNTDOWN_TICKS * 200;
    let halftimeCount = 0;

    for (let i = 0; i < maxTicks; i++) {
      const prevSwapped = state.halfSwapped;
      simulateTick(state, allPlayersInput(state, chaseBallInput));

      if (state.halfSwapped && !prevSwapped) halftimeCount++;
      if (state.phase === 'ended') break;
    }

    expect(halftimeCount).toBe(1);
    expect(state.halfSwapped).toBe(true);
  });
});

describe('Acceptance: Substitutions', () => {
  it('substitution rotates reserves onto the field', () => {
    // 5 per team: 4 on field + 1 reserve. Use enough time to trigger a natural sub.
    const duration = SUBSTITUTION_INTERVAL_SECONDS + 20;
    const state = createShortGame(5, 5, duration);
    // Skip halftime (tested separately)
    state.halfSwapped = true;
    const maxTicks = Math.ceil(duration * TICK_RATE) + KICKOFF_COUNTDOWN_TICKS * 50;

    const initialRedOnField = state.players
      .filter((p) => p.team === 'red' && p.onField)
      .map((p) => p.id);

    let subHappened = false;
    let prevSubTime = state.lastSubstitutionTime;

    for (let i = 0; i < maxTicks; i++) {
      simulateTick(state, allPlayersInput(state, chaseBallInput));
      if (state.lastSubstitutionTime !== prevSubTime) {
        subHappened = true;
        break;
      }
      if (state.phase === 'ended') break;
    }

    expect(subHappened).toBe(true);
    const newRedOnField = state.players
      .filter((p) => p.team === 'red' && p.onField)
      .map((p) => p.id);
    expect(newRedOnField).toHaveLength(MAX_ON_FIELD_PER_TEAM);
    expect(newRedOnField).not.toEqual(initialRedOnField);
  });

  it('reserve player gets field time after substitution', () => {
    // 5 per team: IDs 0-3 on field, ID 4 reserve (for red)
    const duration = SUBSTITUTION_INTERVAL_SECONDS + 20;
    const state = createShortGame(5, 5, duration);
    state.halfSwapped = true;
    const maxTicks = Math.ceil(duration * TICK_RATE) + KICKOFF_COUNTDOWN_TICKS * 50;

    expect(state.players[4].onField).toBe(false);
    expect(state.players[4].team).toBe('red');

    for (let i = 0; i < maxTicks; i++) {
      simulateTick(state, allPlayersInput(state, chaseBallInput));
      if (state.players[4].onField) break;
      if (state.phase === 'ended') break;
    }

    expect(state.players[4].onField).toBe(true);
  });

  it('all reserves get fair rotation (6 per team)', () => {
    // 6 per team: 4 on field + 2 reserves. After enough subs, all 6 should play.
    const duration = SUBSTITUTION_INTERVAL_SECONDS * 5;
    const state = createShortGame(6, 6, duration);
    state.halfSwapped = true;
    const maxTicks = Math.ceil(duration * TICK_RATE) + KICKOFF_COUNTDOWN_TICKS * 100;

    const fieldTimeTicks = new Map<number, number>();
    for (const p of state.players) {
      fieldTimeTicks.set(p.id, 0);
    }

    for (let i = 0; i < maxTicks; i++) {
      simulateTick(state, allPlayersInput(state, chaseBallInput));
      for (const p of state.players) {
        if (p.onField) {
          fieldTimeTicks.set(p.id, (fieldTimeTicks.get(p.id) ?? 0) + 1);
        }
      }
      if (state.phase === 'ended') break;
    }

    // Every player should have had field time
    for (const [id, ticks] of fieldTimeTicks) {
      expect(ticks, `player ${id} never got field time`).toBeGreaterThan(0);
    }
  });
});

describe('Acceptance: Ball Physics Integrity', () => {
  it('ball velocity stays within reasonable bounds', () => {
    const state = simulateMatch(3, 3, attackInput);
    const speed = Math.hypot(state.ball.velocity.x, state.ball.velocity.y);
    expect(speed).toBeLessThan(100);
  });

  it('ball Y stays in bounds during active play', () => {
    const state = createShortGame(3, 3, SHORT_MATCH_SECONDS);
    const maxTicks = Math.ceil(SHORT_MATCH_SECONDS * TICK_RATE) + KICKOFF_COUNTDOWN_TICKS * 50;

    for (let i = 0; i < maxTicks; i++) {
      simulateTick(state, allPlayersInput(state, attackInput));

      if (state.phase === 'playing') {
        expect(state.ball.position.y, `tick ${i}: ball top`).toBeGreaterThanOrEqual(-BALL_RADIUS);
        expect(state.ball.position.y, `tick ${i}: ball bottom`).toBeLessThanOrEqual(
          FIELD_HEIGHT + BALL_RADIUS,
        );
      }

      if (state.phase === 'ended') break;
    }
  });
});

describe('Acceptance: Player Collision Integrity', () => {
  it('player overlaps stay within acceptable limits', () => {
    const state = createShortGame(3, 3, SHORT_MATCH_SECONDS);
    const maxTicks = Math.ceil(SHORT_MATCH_SECONDS * TICK_RATE) + KICKOFF_COUNTDOWN_TICKS * 50;
    let overlapFrames = 0;
    let totalPlayingFrames = 0;

    for (let i = 0; i < maxTicks; i++) {
      simulateTick(state, allPlayersInput(state, chaseBallInput));

      if (state.phase === 'playing') {
        totalPlayingFrames++;
        const active = state.players.filter((p) => p.onField);
        for (let a = 0; a < active.length; a++) {
          for (let b = a + 1; b < active.length; b++) {
            const dist = Math.hypot(
              active[a].position.x - active[b].position.x,
              active[a].position.y - active[b].position.y,
            );
            if (dist < PLAYER_RADIUS * 2 - 2) {
              overlapFrames++;
              break;
            }
          }
        }
      }

      if (state.phase === 'ended') break;
    }

    const overlapRate = totalPlayingFrames > 0 ? overlapFrames / totalPlayingFrames : 0;
    expect(overlapRate, `overlap rate ${(overlapRate * 100).toFixed(1)}%`).toBeLessThan(0.05);
  });
});

describe('Acceptance: Overtime', () => {
  it('tied match enters sudden death overtime', () => {
    // Use idle bots → 0-0 → should trigger overtime
    const state = createShortGame(1, 1, SHORT_MATCH_SECONDS);
    const maxTicks = Math.ceil(SHORT_MATCH_SECONDS * TICK_RATE * 3) + KICKOFF_COUNTDOWN_TICKS * 100;

    let overtimeReached = false;
    for (let i = 0; i < maxTicks; i++) {
      simulateTick(
        state,
        allPlayersInput(state, () => ({ dx: 0, dy: 0, kick: false })),
      );
      if (state.inOvertime) {
        overtimeReached = true;
      }
      if (state.phase === 'ended') break;
    }

    expect(overtimeReached).toBe(true);
    expect(state.phase).toBe('ended');
  });
});

describe('Acceptance: Edge Cases', () => {
  it('1v1 with attackers completes', () => {
    const state = simulateMatch(1, 1, attackInput);
    expect(state.phase).toBe('ended');
  });

  it('1v3 asymmetric match completes', () => {
    const state = simulateMatch(1, 3, attackInput);
    expect(state.phase).toBe('ended');
  });

  it('all-idle inputs completes', () => {
    const state = simulateMatch(3, 3, () => ({ dx: 0, dy: 0, kick: false }));
    expect(state.phase).toBe('ended');
  });

  it('constant kicking does not break physics', () => {
    const state = simulateMatch(3, 3, (p, s) => ({ ...chaseBallInput(p, s), kick: true }));
    expect(state.phase).toBe('ended');
  });

  it('all diagonal movement completes', () => {
    const state = simulateMatch(3, 3, () => ({ dx: 1, dy: 1, kick: true }));
    expect(state.phase).toBe('ended');
  });
});
