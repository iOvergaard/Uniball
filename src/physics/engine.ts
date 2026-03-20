import { GameState, InputFrame, PlayerState } from '../types';
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_MASS,
  PLAYER_DAMPING,
  PLAYER_ACCEL,
  MAX_PLAYER_SPEED,
  BALL_RADIUS,
  BALL_MASS,
  BALL_DAMPING,
  KICK_RANGE,
  KICK_FORCE,
  KICK_COOLDOWN_TICKS,
  WALL_RESTITUTION_PLAYER,
  WALL_RESTITUTION_BALL,
  GOAL_Y_MIN,
  GOAL_Y_MAX,
  MATCH_DURATION_SECONDS,
  HALFTIME_SECONDS,
  KICKOFF_COUNTDOWN_TICKS,
  TICK_RATE,
  MAX_ON_FIELD_PER_TEAM,
  SUBSTITUTION_INTERVAL_SECONDS,
  OVERTIME_DURATION_SECONDS,
} from '../constants';
import {
  vec2,
  vec2Normalize,
  vec2Sub,
  vec2Length,
  vec2AddMut,
  vec2ScaleMut,
  vec2ClampMut,
} from '../util/math';
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
      onField: i < MAX_ON_FIELD_PER_TEAM,
      benchedAtTick: 0,
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
      onField: i < MAX_ON_FIELD_PER_TEAM,
      benchedAtTick: 0,
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
    lastSubstitutionTime: MATCH_DURATION_SECONDS,
    inOvertime: false,
  };

  resetPlayersToPositions(state.players, state.halfSwapped);
  return state;
}

/** Perform forced substitution for a team: bench the longest-on-field player, bring in longest-waiting reserve. */
function substituteTeam(players: PlayerState[], team: 'red' | 'blue', tick: number): void {
  const onField = players.filter((p) => p.team === team && p.onField);
  const reserves = players.filter((p) => p.team === team && !p.onField);
  if (reserves.length === 0) return;

  // Pick longest-waiting reserve (lowest benchedAtTick = been waiting longest)
  reserves.sort((a, b) => a.benchedAtTick - b.benchedAtTick);

  // Bench the first on-field player, bring in longest-waiting reserve
  onField[0].onField = false;
  onField[0].benchedAtTick = tick;
  reserves[0].onField = true;
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

  // Check game over / overtime
  if (state.matchTime <= 0) {
    state.matchTime = 0;
    if (state.inOvertime) {
      // Overtime expired with no golden goal — ends as draw
      state.phase = 'ended';
      return;
    }
    // Regulation ended — tie goes to sudden death overtime
    if (state.scoreRed === state.scoreBlue) {
      state.inOvertime = true;
      state.phase = 'kickoff';
      state.kickoffCountdown = KICKOFF_COUNTDOWN_TICKS;
      state.matchTime = OVERTIME_DURATION_SECONDS;
      state.ball.position = vec2(FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
      state.ball.velocity = vec2(0, 0);
      resetPlayersToPositions(state.players, state.halfSwapped);
      return;
    }
    state.phase = 'ended';
    return;
  }

  // --- Forced substitutions every SUBSTITUTION_INTERVAL_SECONDS ---
  const elapsed = state.lastSubstitutionTime - state.matchTime;
  if (elapsed >= SUBSTITUTION_INTERVAL_SECONDS) {
    substituteTeam(state.players, 'red', state.tick);
    substituteTeam(state.players, 'blue', state.tick);
    state.lastSubstitutionTime = state.matchTime;
    resetPlayersToPositions(state.players, state.halfSwapped);
  }

  // --- Apply player inputs (on-field only) ---
  // Build active list without allocation via filter
  const players = state.players;
  const activeCount = players.length;
  for (let pi = 0; pi < activeCount; pi++) {
    const player = players[pi];
    if (!player.onField) continue;

    const input = inputs.get(player.id);
    if (input) {
      const dir = vec2Normalize(vec2(input.dx, input.dy));
      vec2ScaleMut(dir, PLAYER_ACCEL);
      vec2AddMut(player.velocity, dir);
      vec2ClampMut(player.velocity, MAX_PLAYER_SPEED);

      // Kick
      if (input.kick && player.kickCooldown <= 0) {
        const toBall = vec2Sub(state.ball.position, player.position);
        const dist = vec2Length(toBall);
        if (dist < KICK_RANGE && dist > 0) {
          const kickDir = vec2Normalize(toBall);
          vec2ScaleMut(kickDir, KICK_FORCE);
          vec2AddMut(state.ball.velocity, kickDir);
          player.kickCooldown = KICK_COOLDOWN_TICKS;
        }
      }
    }

    // Tick cooldown
    if (player.kickCooldown > 0) player.kickCooldown--;

    // Apply damping (in-place)
    vec2ScaleMut(player.velocity, PLAYER_DAMPING);

    // Integrate position (in-place)
    vec2AddMut(player.position, player.velocity);
  }

  // --- Ball physics ---
  vec2ScaleMut(state.ball.velocity, BALL_DAMPING);
  vec2AddMut(state.ball.position, state.ball.velocity);

  // --- Build active player list for collision ---
  const activePlayers: PlayerState[] = [];
  for (let pi = 0; pi < activeCount; pi++) {
    if (players[pi].onField) activePlayers.push(players[pi]);
  }

  // --- Player-ball collision ---
  const ballCircle = {
    position: state.ball.position,
    velocity: state.ball.velocity,
    radius: BALL_RADIUS,
    mass: BALL_MASS,
  };
  for (let i = 0; i < activePlayers.length; i++) {
    const player = activePlayers[i];
    resolveCircleCircle(
      {
        position: player.position,
        velocity: player.velocity,
        radius: PLAYER_RADIUS,
        mass: PLAYER_MASS,
      },
      ballCircle,
    );
  }

  // --- Player-player collision ---
  for (let i = 0; i < activePlayers.length; i++) {
    for (let j = i + 1; j < activePlayers.length; j++) {
      const a = activePlayers[i];
      const b = activePlayers[j];
      resolveCircleCircle(
        { position: a.position, velocity: a.velocity, radius: PLAYER_RADIUS, mass: PLAYER_MASS },
        { position: b.position, velocity: b.velocity, radius: PLAYER_RADIUS, mass: PLAYER_MASS },
      );
    }
  }

  // --- Wall collisions ---
  for (const player of activePlayers) {
    resolveCircleWall(
      player.position,
      player.velocity,
      PLAYER_RADIUS,
      FIELD_WIDTH,
      FIELD_HEIGHT,
      WALL_RESTITUTION_PLAYER,
      GOAL_Y_MIN,
      GOAL_Y_MAX,
      false,
    );
  }
  resolveCircleWall(
    state.ball.position,
    state.ball.velocity,
    BALL_RADIUS,
    FIELD_WIDTH,
    FIELD_HEIGHT,
    WALL_RESTITUTION_BALL,
    GOAL_Y_MIN,
    GOAL_Y_MAX,
    true,
  );

  // --- Goal detection ---
  const scoringTeam = checkGoal(state.ball.position);
  if (scoringTeam) {
    if (scoringTeam === 'red') state.scoreRed++;
    else state.scoreBlue++;

    // Golden goal in overtime — match ends immediately
    if (state.inOvertime) {
      state.phase = 'ended';
      state.matchTime = 0;
      return;
    }

    // Reset for kickoff
    state.phase = 'kickoff';
    state.kickoffCountdown = KICKOFF_COUNTDOWN_TICKS;
    state.ball.position = vec2(FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    state.ball.velocity = vec2(0, 0);
    resetPlayersToPositions(state.players, state.halfSwapped);
  }
}

/**
 * Remove a player from the game. If the player was on field and the team has
 * reserves, immediately sub one in. Returns the removed player's name (for notifications).
 */
export function removePlayer(state: GameState, playerId: number): string | null {
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return null;

  const player = state.players[idx];
  const name = player.name;
  const team = player.team;
  const wasOnField = player.onField;

  // Remove from players array
  state.players.splice(idx, 1);

  // If the removed player was on field and the team has a reserve, sub one in
  if (wasOnField) {
    const reserves = state.players.filter((p) => p.team === team && !p.onField);
    if (reserves.length > 0) {
      // Pick longest-waiting reserve
      reserves.sort((a, b) => a.benchedAtTick - b.benchedAtTick);
      reserves[0].onField = true;
    }
    // Reset positions so players aren't left in weird spots
    resetPlayersToPositions(state.players, state.halfSwapped);
  }

  return name;
}
