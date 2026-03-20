import { GameState, InputFrame } from '../types';
import {
  FIELD_WIDTH, FIELD_HEIGHT,
  PLAYER_RADIUS, PLAYER_MASS, PLAYER_DAMPING, PLAYER_ACCEL, MAX_PLAYER_SPEED,
  BALL_RADIUS, BALL_MASS, BALL_DAMPING,
  KICK_RANGE, KICK_FORCE, KICK_COOLDOWN_TICKS,
  WALL_RESTITUTION_PLAYER, WALL_RESTITUTION_BALL,
  GOAL_Y_MIN, GOAL_Y_MAX,
  MATCH_DURATION_SECONDS, HALFTIME_SECONDS,
  KICKOFF_COUNTDOWN_TICKS, TICK_RATE,
} from '../constants';
import { vec2, vec2Add, vec2Scale, vec2Normalize, vec2Sub, vec2Length } from '../util/math';
import { resolveCircleCircle, resolveCircleWall } from './collision';
import { checkGoal, resetPlayersToPositions } from './field';

/** Create initial game state for given player counts. */
export function createGameState(redCount: number, blueCount: number): GameState {
  const players = [];

  for (let i = 0; i < redCount; i++) {
    players.push({
      id: i,
      position: vec2(0, 0),
      velocity: vec2(0, 0),
      team: 'red' as const,
      kickCooldown: 0,
      name: `Red ${i + 1}`,
    });
  }
  for (let i = 0; i < blueCount; i++) {
    players.push({
      id: redCount + i,
      position: vec2(0, 0),
      velocity: vec2(0, 0),
      team: 'blue' as const,
      kickCooldown: 0,
      name: `Blue ${i + 1}`,
    });
  }

  const state: GameState = {
    tick: 0,
    matchTime: MATCH_DURATION_SECONDS,
    phase: 'kickoff',
    kickoffCountdown: KICKOFF_COUNTDOWN_TICKS,
    scoreRed: 0,
    scoreBlue: 0,
    players,
    ball: { position: vec2(FIELD_WIDTH / 2, FIELD_HEIGHT / 2), velocity: vec2(0, 0) },
    halfSwapped: false,
  };

  resetPlayersToPositions(state.players, state.halfSwapped);
  return state;
}

/** Advance simulation by one tick. inputs is a Map from player id → InputFrame. */
export function simulateTick(state: GameState, inputs: Map<number, InputFrame>): void {
  state.tick++;

  // --- Kickoff countdown ---
  if (state.phase === 'kickoff') {
    state.kickoffCountdown--;
    if (state.kickoffCountdown <= 0) {
      state.phase = 'playing';
    }
    return; // Freeze physics during countdown
  }

  if (state.phase === 'ended') return;

  // --- Match timer ---
  state.matchTime -= 1 / TICK_RATE;

  // Check halftime
  if (!state.halfSwapped && state.matchTime <= HALFTIME_SECONDS) {
    state.halfSwapped = true;
    state.phase = 'kickoff';
    state.kickoffCountdown = KICKOFF_COUNTDOWN_TICKS;
    state.ball.position = vec2(FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    state.ball.velocity = vec2(0, 0);
    resetPlayersToPositions(state.players, state.halfSwapped);
    return;
  }

  // Check game over
  if (state.matchTime <= 0) {
    state.matchTime = 0;
    state.phase = 'ended';
    return;
  }

  // --- Apply player inputs ---
  for (const player of state.players) {
    const input = inputs.get(player.id);
    if (input) {
      const dir = vec2Normalize(vec2(input.dx, input.dy));
      player.velocity = vec2Add(player.velocity, vec2Scale(dir, PLAYER_ACCEL));

      // Clamp speed
      const speed = vec2Length(player.velocity);
      if (speed > MAX_PLAYER_SPEED) {
        player.velocity = vec2Scale(vec2Normalize(player.velocity), MAX_PLAYER_SPEED);
      }

      // Kick
      if (input.kick && player.kickCooldown <= 0) {
        const toBall = vec2Sub(state.ball.position, player.position);
        const dist = vec2Length(toBall);
        if (dist < KICK_RANGE && dist > 0) {
          const kickDir = vec2Normalize(toBall);
          state.ball.velocity = vec2Add(state.ball.velocity, vec2Scale(kickDir, KICK_FORCE));
          player.kickCooldown = KICK_COOLDOWN_TICKS;
        }
      }
    }

    // Tick cooldown
    if (player.kickCooldown > 0) player.kickCooldown--;

    // Apply damping
    player.velocity = vec2Scale(player.velocity, PLAYER_DAMPING);

    // Integrate position
    player.position = vec2Add(player.position, player.velocity);
  }

  // --- Ball physics ---
  state.ball.velocity = vec2Scale(state.ball.velocity, BALL_DAMPING);
  state.ball.position = vec2Add(state.ball.position, state.ball.velocity);

  // --- Player-ball collision ---
  for (const player of state.players) {
    resolveCircleCircle(
      { position: player.position, velocity: player.velocity, radius: PLAYER_RADIUS, mass: PLAYER_MASS },
      { position: state.ball.position, velocity: state.ball.velocity, radius: BALL_RADIUS, mass: BALL_MASS },
    );
  }

  // --- Player-player collision ---
  for (let i = 0; i < state.players.length; i++) {
    for (let j = i + 1; j < state.players.length; j++) {
      const a = state.players[i];
      const b = state.players[j];
      resolveCircleCircle(
        { position: a.position, velocity: a.velocity, radius: PLAYER_RADIUS, mass: PLAYER_MASS },
        { position: b.position, velocity: b.velocity, radius: PLAYER_RADIUS, mass: PLAYER_MASS },
      );
    }
  }

  // --- Wall collisions ---
  for (const player of state.players) {
    resolveCircleWall(
      player.position, player.velocity, PLAYER_RADIUS,
      FIELD_WIDTH, FIELD_HEIGHT, WALL_RESTITUTION_PLAYER,
      GOAL_Y_MIN, GOAL_Y_MAX, false,
    );
  }
  resolveCircleWall(
    state.ball.position, state.ball.velocity, BALL_RADIUS,
    FIELD_WIDTH, FIELD_HEIGHT, WALL_RESTITUTION_BALL,
    GOAL_Y_MIN, GOAL_Y_MAX, true,
  );

  // --- Goal detection ---
  const scoringTeam = checkGoal(state.ball.position);
  if (scoringTeam) {
    if (scoringTeam === 'red') state.scoreRed++;
    else state.scoreBlue++;

    // Reset for kickoff
    state.phase = 'kickoff';
    state.kickoffCountdown = KICKOFF_COUNTDOWN_TICKS;
    state.ball.position = vec2(FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    state.ball.velocity = vec2(0, 0);
    resetPlayersToPositions(state.players, state.halfSwapped);
  }
}
