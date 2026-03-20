import { describe, it, expect } from 'vitest';
import { createGameState, simulateTick } from './engine';
import { InputFrame, GameState } from '../types';
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  TICK_RATE,
  KICKOFF_COUNTDOWN_TICKS,
  MATCH_DURATION_SECONDS,
  KICK_RANGE,
  PLAYER_RADIUS,
  MAX_ON_FIELD_PER_TEAM,
  SUBSTITUTION_INTERVAL_SECONDS,
} from '../constants';

function noInput(): Map<number, InputFrame> {
  return new Map();
}

function makeInput(id: number, dx: number, dy: number, kick: boolean): Map<number, InputFrame> {
  const m = new Map<number, InputFrame>();
  m.set(id, { dx, dy, kick });
  return m;
}

function skipKickoff(state: GameState): void {
  for (let i = 0; i < KICKOFF_COUNTDOWN_TICKS + 1; i++) {
    simulateTick(state, noInput());
  }
}

describe('Initial State', () => {
  it('creates correct player counts and teams', () => {
    const state = createGameState(2, 2);
    expect(state.players).toHaveLength(4);
    expect(state.players.filter((p) => p.team === 'red')).toHaveLength(2);
    expect(state.players.filter((p) => p.team === 'blue')).toHaveLength(2);
  });

  it('places ball at center', () => {
    const state = createGameState(1, 1);
    expect(state.ball.position.x).toBe(FIELD_WIDTH / 2);
    expect(state.ball.position.y).toBe(FIELD_HEIGHT / 2);
  });

  it('starts in kickoff phase with 0-0 score', () => {
    const state = createGameState(1, 1);
    expect(state.phase).toBe('kickoff');
    expect(state.scoreRed).toBe(0);
    expect(state.scoreBlue).toBe(0);
    expect(state.matchTime).toBe(MATCH_DURATION_SECONDS);
  });
});

describe('Kickoff Countdown', () => {
  it('freezes physics during countdown', () => {
    const state = createGameState(1, 1);
    const playerPos = { ...state.players[0].position };

    simulateTick(state, makeInput(0, 1, 0, false));
    expect(state.phase).toBe('kickoff');
    expect(state.players[0].position.x).toBe(playerPos.x);
    expect(state.players[0].position.y).toBe(playerPos.y);
  });

  it('transitions to playing after countdown', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);
    expect(state.phase).toBe('playing');
  });
});

describe('Player Movement', () => {
  it('moves player in input direction', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);
    const startX = state.players[0].position.x;

    for (let i = 0; i < 30; i++) {
      simulateTick(state, makeInput(0, 1, 0, false));
    }

    expect(state.players[0].position.x).toBeGreaterThan(startX);
    expect(state.players[0].velocity.x).toBeGreaterThan(0);
  });

  it('decelerates with damping when no input', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    for (let i = 0; i < 30; i++) {
      simulateTick(state, makeInput(0, 1, 0, false));
    }

    const velBefore = state.players[0].velocity.x;
    simulateTick(state, noInput());
    expect(state.players[0].velocity.x).toBeLessThan(velBefore);
  });
});

describe('Wall Boundaries', () => {
  it('keeps player inside top wall', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    for (let i = 0; i < 200; i++) {
      simulateTick(state, makeInput(0, 0, -1, false));
    }

    expect(state.players[0].position.y).toBeGreaterThanOrEqual(0);
  });

  it('keeps player inside bottom wall', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    for (let i = 0; i < 400; i++) {
      simulateTick(state, makeInput(0, 0, 1, false));
    }

    expect(state.players[0].position.y).toBeLessThanOrEqual(FIELD_HEIGHT);
  });
});

describe('Kick Mechanic', () => {
  it('kicks ball when in range', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    state.players[0].position = { x: FIELD_WIDTH / 2 - KICK_RANGE + 5, y: FIELD_HEIGHT / 2 };
    state.players[0].velocity = { x: 0, y: 0 };

    const ballVelBefore = Math.hypot(state.ball.velocity.x, state.ball.velocity.y);
    simulateTick(state, makeInput(0, 1, 0, true));
    const ballVelAfter = Math.hypot(state.ball.velocity.x, state.ball.velocity.y);

    expect(ballVelAfter).toBeGreaterThan(ballVelBefore);
    expect(state.players[0].kickCooldown).toBeGreaterThan(0);
  });

  it('prevents kick during cooldown', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    state.players[0].position = { x: FIELD_WIDTH / 2 - KICK_RANGE + 5, y: FIELD_HEIGHT / 2 };
    state.players[0].velocity = { x: 0, y: 0 };

    simulateTick(state, makeInput(0, 1, 0, true));
    expect(state.players[0].kickCooldown).toBeGreaterThan(0);

    // Second kick should be blocked by cooldown
    state.players[0].position = { x: FIELD_WIDTH / 2 - KICK_RANGE + 5, y: FIELD_HEIGHT / 2 };
    simulateTick(state, makeInput(0, 0, 0, true));
    expect(state.players[0].kickCooldown).toBeGreaterThan(0);
  });
});

describe('Goal Scoring', () => {
  it('scores when ball enters right goal', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    state.ball.position = { x: FIELD_WIDTH - 5, y: FIELD_HEIGHT / 2 };
    state.ball.velocity = { x: 10, y: 0 };
    simulateTick(state, noInput());

    expect(state.scoreRed).toBe(1);
    expect(state.phase).toBe('kickoff');
    expect(state.ball.position.x).toBe(FIELD_WIDTH / 2);
  });

  it('scores when ball enters left goal', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    state.ball.position = { x: 5, y: FIELD_HEIGHT / 2 };
    state.ball.velocity = { x: -10, y: 0 };
    simulateTick(state, noInput());

    expect(state.scoreBlue).toBe(1);
  });
});

describe('Halftime', () => {
  it('swaps sides at halftime', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    const halfTimeTicks = Math.floor((MATCH_DURATION_SECONDS / 2) * TICK_RATE) + 10;
    for (let i = 0; i < halfTimeTicks; i++) {
      simulateTick(state, noInput());
      if (state.phase === 'kickoff') skipKickoff(state);
    }

    expect(state.halfSwapped).toBe(true);
  });
});

describe('Game Over', () => {
  it('ends when timer reaches 0', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    const totalTicks = Math.ceil(MATCH_DURATION_SECONDS * TICK_RATE) + 100;
    for (let i = 0; i < totalTicks; i++) {
      simulateTick(state, noInput());
      if (state.phase === 'kickoff') skipKickoff(state);
      if (state.phase === 'ended') break;
    }

    expect(state.phase).toBe('ended');
    expect(state.matchTime).toBe(0);
  });
});

describe('Player-Player Collision', () => {
  it('separates overlapping players', () => {
    const state = createGameState(2, 0);
    skipKickoff(state);

    state.players[0].position = { x: 200, y: 200 };
    state.players[1].position = { x: 201, y: 200 };
    simulateTick(state, noInput());

    const dist = Math.hypot(
      state.players[0].position.x - state.players[1].position.x,
      state.players[0].position.y - state.players[1].position.y,
    );
    expect(dist).toBeGreaterThanOrEqual(PLAYER_RADIUS * 2 - 1);
  });
});

describe('Reserve Players and Substitutions', () => {
  it('caps on-field players at MAX_ON_FIELD_PER_TEAM', () => {
    const state = createGameState(6, 5);
    const redOnField = state.players.filter((p) => p.team === 'red' && p.onField);
    const blueOnField = state.players.filter((p) => p.team === 'blue' && p.onField);
    expect(redOnField).toHaveLength(MAX_ON_FIELD_PER_TEAM);
    expect(blueOnField).toHaveLength(MAX_ON_FIELD_PER_TEAM);
  });

  it('puts excess players on the bench', () => {
    const state = createGameState(6, 5);
    const redReserves = state.players.filter((p) => p.team === 'red' && !p.onField);
    const blueReserves = state.players.filter((p) => p.team === 'blue' && !p.onField);
    expect(redReserves).toHaveLength(2);
    expect(blueReserves).toHaveLength(1);
  });

  it('supports unequal team sizes', () => {
    const state = createGameState(7, 3);
    expect(state.players.filter((p) => p.team === 'red')).toHaveLength(7);
    expect(state.players.filter((p) => p.team === 'blue')).toHaveLength(3);
    expect(state.players.filter((p) => p.team === 'red' && p.onField)).toHaveLength(
      MAX_ON_FIELD_PER_TEAM,
    );
    expect(state.players.filter((p) => p.team === 'blue' && p.onField)).toHaveLength(3);
  });

  it('performs forced substitution after interval', () => {
    const state = createGameState(6, 6);
    skipKickoff(state);

    // Record who is initially on field for red
    const initialRedOnField = state.players
      .filter((p) => p.team === 'red' && p.onField)
      .map((p) => p.id);

    // Fast-forward past the substitution interval
    const ticksToSub = Math.ceil(SUBSTITUTION_INTERVAL_SECONDS * TICK_RATE) + 10;
    for (let i = 0; i < ticksToSub; i++) {
      simulateTick(state, noInput());
      if (state.phase === 'kickoff') skipKickoff(state);
    }

    // After substitution, the roster should have rotated
    const newRedOnField = state.players
      .filter((p) => p.team === 'red' && p.onField)
      .map((p) => p.id);

    // Still max players on field
    expect(newRedOnField).toHaveLength(MAX_ON_FIELD_PER_TEAM);
    // At least one player should have changed
    expect(newRedOnField).not.toEqual(initialRedOnField);
  });

  it('does not substitute when team has no reserves', () => {
    const state = createGameState(2, 2);
    skipKickoff(state);

    const initialIds = state.players.filter((p) => p.onField).map((p) => p.id);

    // Fast-forward past the substitution interval
    const ticksToSub = Math.ceil(SUBSTITUTION_INTERVAL_SECONDS * TICK_RATE) + 10;
    for (let i = 0; i < ticksToSub; i++) {
      simulateTick(state, noInput());
      if (state.phase === 'kickoff') skipKickoff(state);
    }

    const afterIds = state.players.filter((p) => p.onField).map((p) => p.id);

    expect(afterIds).toEqual(initialIds);
  });

  it('total player count stays the same after substitutions', () => {
    const state = createGameState(7, 7);
    skipKickoff(state);

    const totalBefore = state.players.length;

    const ticksToSub = Math.ceil(SUBSTITUTION_INTERVAL_SECONDS * TICK_RATE) + 10;
    for (let i = 0; i < ticksToSub; i++) {
      simulateTick(state, noInput());
      if (state.phase === 'kickoff') skipKickoff(state);
    }

    expect(state.players).toHaveLength(totalBefore);
  });
});

describe('Two-Player Local Input', () => {
  it('both players move independently with separate inputs', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    const p0Start = { ...state.players[0].position };
    const p1Start = { ...state.players[1].position };

    // Player 0 moves right, Player 1 moves left
    const inputs = new Map<number, InputFrame>();
    inputs.set(0, { dx: 1, dy: 0, kick: false });
    inputs.set(1, { dx: -1, dy: 0, kick: false });

    for (let i = 0; i < 30; i++) {
      simulateTick(state, inputs);
    }

    expect(state.players[0].position.x).toBeGreaterThan(p0Start.x);
    expect(state.players[1].position.x).toBeLessThan(p1Start.x);
  });

  it('only the player with input moves', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    const p1Start = { ...state.players[1].position };

    // Only Player 0 has input
    for (let i = 0; i < 30; i++) {
      simulateTick(state, makeInput(0, 0, 1, false));
    }

    // Player 1 should stay roughly in place (only damping, no acceleration)
    expect(Math.abs(state.players[1].position.x - p1Start.x)).toBeLessThan(1);
    expect(Math.abs(state.players[1].position.y - p1Start.y)).toBeLessThan(1);
  });

  it('both players can kick the ball', () => {
    const state = createGameState(1, 1);
    skipKickoff(state);

    // Move player 0 close to ball and kick
    state.players[0].position = {
      x: state.ball.position.x - PLAYER_RADIUS - 5,
      y: state.ball.position.y,
    };
    simulateTick(state, makeInput(0, 1, 0, true));
    const ballSpeedAfterP0Kick = Math.hypot(state.ball.velocity.x, state.ball.velocity.y);
    expect(ballSpeedAfterP0Kick).toBeGreaterThan(0);

    // Reset ball
    state.ball.velocity = { x: 0, y: 0 };
    state.ball.position = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 };

    // Move player 1 close to ball and kick
    state.players[1].position = {
      x: state.ball.position.x + PLAYER_RADIUS + 5,
      y: state.ball.position.y,
    };
    state.players[1].kickCooldown = 0;
    simulateTick(state, makeInput(1, -1, 0, true));
    const ballSpeedAfterP1Kick = Math.hypot(state.ball.velocity.x, state.ball.velocity.y);
    expect(ballSpeedAfterP1Kick).toBeGreaterThan(0);
  });

  it('two-player game has one red and one blue player', () => {
    const state = createGameState(1, 1);
    expect(state.players[0].team).toBe('red');
    expect(state.players[1].team).toBe('blue');
    expect(state.players).toHaveLength(2);
  });
});
