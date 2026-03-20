import { describe, it, expect } from 'vitest';
import { createGameState, simulateTick } from '../physics/engine';
import { FIELD_WIDTH } from '../constants';
import type { InputFrame, GameState } from '../types';
import { fitCamera } from './camera';

/**
 * Phase 5 tests: Snapshot-test game state at key visual moments.
 * No actual visual rendering (no canvas in Node), but verify game state
 * is correct at goal, halftime, substitution, and game-over moments
 * so the renderer has the right data.
 */

function makeInputs(
  state: GameState,
  dx: number,
  dy: number,
  kick: boolean,
): Map<number, InputFrame> {
  const inputs = new Map<number, InputFrame>();
  for (const player of state.players) {
    if (player.onField) {
      inputs.set(player.id, { dx, dy, kick });
    }
  }
  return inputs;
}

function advanceTicks(state: GameState, n: number, dx = 0, dy = 0, kick = false): void {
  for (let t = 0; t < n; t++) {
    simulateTick(state, makeInputs(state, dx, dy, kick));
  }
}

describe('Renderer state snapshots', () => {
  it('kickoff: state has correct phase and countdown at start', () => {
    const state = createGameState(2, 2);
    expect(state.phase).toBe('kickoff');
    expect(state.kickoffCountdown).toBe(180); // 3 seconds at 60 Hz
    expect(state.tick).toBe(0);
    expect(state.scoreRed).toBe(0);
    expect(state.scoreBlue).toBe(0);
  });

  it('kickoff countdown decrements and transitions to playing', () => {
    const state = createGameState(1, 1);
    advanceTicks(state, 90);
    expect(state.phase).toBe('kickoff');
    expect(state.kickoffCountdown).toBe(90);

    advanceTicks(state, 90);
    expect(state.phase).toBe('playing');
    expect(state.kickoffCountdown).toBe(0);
  });

  it('halftime state snapshot: halfSwapped transitions and phase goes to kickoff', () => {
    const state = createGameState(1, 1);
    expect(state.halfSwapped).toBe(false);

    // Advance to halftime (150 seconds = 9000 ticks + 180 kickoff ticks)
    advanceTicks(state, 9180);

    // Should be at or past halftime — engine sets halfSwapped=true and phase='kickoff'
    expect(state.halfSwapped).toBe(true);
    // Engine does NOT set phase='halftime' — it goes directly to 'kickoff' for the restart
    // The renderer detects halftime via the halfSwapped false→true transition
    expect(state.phase).not.toBe('halftime');
  });

  it('game-over state: phase is ended at match end', () => {
    const state = createGameState(1, 1);
    // Full match + overtime (0-0 triggers sudden death): ~300 + 60 seconds + kickoff ticks
    advanceTicks(state, 24000);

    expect(state.phase).toBe('ended');
    expect(state.matchTime).toBeLessThanOrEqual(0);
  });

  it('substitution state: lastSubstitutionTime changes when subs happen', () => {
    const state = createGameState(5, 5); // 5v5 means 1 reserve each
    const initialSubTime = state.lastSubstitutionTime;

    // Advance past substitution interval (60 seconds = 3600 ticks + kickoff)
    advanceTicks(state, 4000);

    // Substitution should have happened
    expect(state.lastSubstitutionTime).not.toBe(initialSubTime);
  });

  it('kick cooldown snapshot: cooldown is set after kick', () => {
    const state = createGameState(1, 1);
    // Past kickoff
    advanceTicks(state, 181);

    // Move player toward ball and kick
    for (let t = 0; t < 60; t++) {
      const p = state.players[0];
      const dx = state.ball.position.x - p.position.x;
      const dy = state.ball.position.y - p.position.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const inputs = new Map<number, InputFrame>();
      inputs.set(0, { dx: len > 0 ? dx / len : 0, dy: len > 0 ? dy / len : 0, kick: true });
      inputs.set(1, { dx: 0, dy: 0, kick: false });
      simulateTick(state, inputs);

      if (state.players[0].kickCooldown > 0) break;
    }

    // Player should have kicked (cooldown active)
    expect(state.players[0].kickCooldown).toBeGreaterThan(0);
  });

  it('player velocity reflects movement direction for unicorn rotation', () => {
    const state = createGameState(1, 1);
    // Past kickoff
    advanceTicks(state, 181);

    // Move player right
    for (let t = 0; t < 30; t++) {
      const inputs = new Map<number, InputFrame>();
      inputs.set(0, { dx: 1, dy: 0, kick: false });
      inputs.set(1, { dx: 0, dy: 0, kick: false });
      simulateTick(state, inputs);
    }

    // Player 0 should have positive x velocity
    expect(state.players[0].velocity.x).toBeGreaterThan(0);
    // y velocity should be near 0
    expect(Math.abs(state.players[0].velocity.y)).toBeLessThan(0.5);
  });
});

describe('Camera', () => {
  it('fits field into a 1920x1080 canvas', () => {
    const cam = fitCamera(1920, 1080);
    expect(cam.scale).toBeGreaterThan(0);
    expect(cam.offsetX).toBeGreaterThan(0);
    expect(cam.offsetY).toBeGreaterThan(0);
  });

  it('fits field into a small mobile canvas', () => {
    const cam = fitCamera(640, 360);
    expect(cam.scale).toBeGreaterThan(0);
    expect(cam.scale).toBeLessThan(1);
  });

  it('maintains aspect ratio for different screen sizes', () => {
    const cam1 = fitCamera(1920, 1080);
    const cam2 = fitCamera(1280, 720);
    // Both should use the same ratio of field dimensions
    // The scale should be proportional to the smaller dimension
    expect(cam1.scale).toBeGreaterThan(cam2.scale);
  });

  it('centers the field horizontally', () => {
    const cam = fitCamera(1920, 1080);
    // offsetX should center: (1920 - FIELD_WIDTH * scale) / 2
    const expectedX = (1920 - FIELD_WIDTH * cam.scale) / 2;
    expect(cam.offsetX).toBeCloseTo(expectedX, 1);
  });
});
