/**
 * Headless playtest — runs the game simulation without a browser
 * to verify physics, scoring, kickoff, halftime, and game-over logic.
 *
 * Run with: npx tsx src/playtest.ts
 */
import { createGameState, simulateTick } from './physics/engine';
import { InputFrame, GameState } from './types';
import {
  FIELD_WIDTH, FIELD_HEIGHT, TICK_RATE,
  KICKOFF_COUNTDOWN_TICKS, MATCH_DURATION_SECONDS,
  KICK_RANGE, PLAYER_RADIUS,
} from './constants';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function noInput(): Map<number, InputFrame> {
  return new Map();
}

function makeInput(id: number, dx: number, dy: number, kick: boolean): Map<number, InputFrame> {
  const m = new Map<number, InputFrame>();
  m.set(id, { dx, dy, kick });
  return m;
}

function skipKickoff(state: GameState): void {
  // Run through the kickoff countdown
  for (let i = 0; i < KICKOFF_COUNTDOWN_TICKS + 1; i++) {
    simulateTick(state, noInput());
  }
}

// ========== TEST: Initial State ==========
console.log('\n--- Test: Initial State ---');
{
  const state = createGameState(2, 2);
  assert(state.players.length === 4, 'Has 4 players');
  assert(state.players.filter(p => p.team === 'red').length === 2, '2 red players');
  assert(state.players.filter(p => p.team === 'blue').length === 2, '2 blue players');
  assert(state.ball.position.x === FIELD_WIDTH / 2, 'Ball at center X');
  assert(state.ball.position.y === FIELD_HEIGHT / 2, 'Ball at center Y');
  assert(state.phase === 'kickoff', 'Starts in kickoff phase');
  assert(state.scoreRed === 0 && state.scoreBlue === 0, 'Score starts 0-0');
  assert(state.matchTime === MATCH_DURATION_SECONDS, 'Match time is full');
}

// ========== TEST: Kickoff Countdown ==========
console.log('\n--- Test: Kickoff Countdown ---');
{
  const state = createGameState(1, 1);
  const playerPos = { ...state.players[0].position };

  // During kickoff, physics should be frozen
  simulateTick(state, makeInput(0, 1, 0, false));
  assert(state.phase === 'kickoff', 'Still in kickoff after 1 tick');
  assert(
    state.players[0].position.x === playerPos.x && state.players[0].position.y === playerPos.y,
    'Player does not move during kickoff',
  );

  // Skip remaining countdown
  skipKickoff(state);
  assert(state.phase === 'playing', 'Phase transitions to playing after countdown');
}

// ========== TEST: Player Movement ==========
console.log('\n--- Test: Player Movement ---');
{
  const state = createGameState(1, 1);
  skipKickoff(state);

  const startX = state.players[0].position.x;

  // Move right for 30 ticks
  for (let i = 0; i < 30; i++) {
    simulateTick(state, makeInput(0, 1, 0, false));
  }

  assert(state.players[0].position.x > startX, 'Player moved right');
  assert(state.players[0].velocity.x > 0, 'Player has rightward velocity');

  // Stop input — player should decelerate via damping
  const velBefore = state.players[0].velocity.x;
  simulateTick(state, noInput());
  assert(state.players[0].velocity.x < velBefore, 'Player decelerates with damping');
}

// ========== TEST: Wall Bounce ==========
console.log('\n--- Test: Wall Boundary ---');
{
  const state = createGameState(1, 1);
  skipKickoff(state);

  // Move player up into the top wall for many ticks
  for (let i = 0; i < 200; i++) {
    simulateTick(state, makeInput(0, 0, -1, false));
  }

  assert(state.players[0].position.y >= 0, 'Player stays inside top wall');

  // Move player down into the bottom wall
  for (let i = 0; i < 400; i++) {
    simulateTick(state, makeInput(0, 0, 1, false));
  }

  assert(state.players[0].position.y <= FIELD_HEIGHT, 'Player stays inside bottom wall');
}

// ========== TEST: Kick Mechanic ==========
console.log('\n--- Test: Kick Mechanic ---');
{
  const state = createGameState(1, 1);
  skipKickoff(state);

  // Place player close to ball so kick test is reliable
  state.players[0].position = { x: FIELD_WIDTH / 2 - KICK_RANGE + 5, y: FIELD_HEIGHT / 2 };
  state.players[0].velocity = { x: 0, y: 0 };

  const ballVelBefore = Math.sqrt(state.ball.velocity.x ** 2 + state.ball.velocity.y ** 2);
  simulateTick(state, makeInput(0, 1, 0, true)); // kick!
  const ballVelAfter = Math.sqrt(state.ball.velocity.x ** 2 + state.ball.velocity.y ** 2);
  assert(ballVelAfter > ballVelBefore, 'Ball speeds up after kick');
  assert(state.players[0].kickCooldown > 0, 'Kick cooldown is set');

  // Test cooldown prevents immediate re-kick
  state.players[0].position = { x: FIELD_WIDTH / 2 - KICK_RANGE + 5, y: FIELD_HEIGHT / 2 };
  simulateTick(state, makeInput(0, 0, 0, true)); // try kick during cooldown
  assert(state.players[0].kickCooldown > 0, 'Cooldown still active, cannot kick again immediately');
}

// ========== TEST: Goal Scoring ==========
console.log('\n--- Test: Goal Scoring ---');
{
  const state = createGameState(1, 1);
  skipKickoff(state);

  // Manually place ball near right goal and give it velocity toward goal
  state.ball.position = { x: FIELD_WIDTH - 5, y: FIELD_HEIGHT / 2 };
  state.ball.velocity = { x: 10, y: 0 };

  simulateTick(state, noInput());

  assert(state.scoreRed === 1, 'Red team scores when ball enters right goal');
  assert(state.phase === 'kickoff', 'Returns to kickoff after goal');
  assert(state.ball.position.x === FIELD_WIDTH / 2, 'Ball reset to center after goal');
}

// ========== TEST: Halftime ==========
console.log('\n--- Test: Halftime ---');
{
  const state = createGameState(1, 1);
  skipKickoff(state);

  // Fast-forward to just past halftime
  const halfTimeTicks = Math.floor(MATCH_DURATION_SECONDS / 2 * TICK_RATE) + 10;
  for (let i = 0; i < halfTimeTicks; i++) {
    simulateTick(state, noInput());
    if (state.phase === 'kickoff') {
      // Skip any kickoff countdowns we hit
      skipKickoff(state);
    }
  }

  assert(state.halfSwapped === true, 'Half swapped after halftime');
}

// ========== TEST: Game Over ==========
console.log('\n--- Test: Game Over ---');
{
  const state = createGameState(1, 1);
  skipKickoff(state);

  // Fast-forward to end of match
  const totalTicks = Math.ceil(MATCH_DURATION_SECONDS * TICK_RATE) + 100;
  for (let i = 0; i < totalTicks; i++) {
    simulateTick(state, noInput());
    if (state.phase === 'kickoff') {
      skipKickoff(state);
    }
    if (state.phase === 'ended') break;
  }

  assert(state.phase === 'ended', 'Game ends when timer reaches 0');
  assert(state.matchTime === 0, 'Match time is exactly 0');
}

// ========== TEST: Player-Player Collision ==========
console.log('\n--- Test: Player-Player Collision ---');
{
  const state = createGameState(2, 0);
  skipKickoff(state);

  // Place two players at same position
  state.players[0].position = { x: 200, y: 200 };
  state.players[1].position = { x: 201, y: 200 }; // overlapping

  simulateTick(state, noInput());

  const dist = Math.sqrt(
    (state.players[0].position.x - state.players[1].position.x) ** 2 +
    (state.players[0].position.y - state.players[1].position.y) ** 2,
  );
  assert(dist >= PLAYER_RADIUS * 2 - 1, 'Players are separated after collision (within 1 unit tolerance)');
}

// ========== Summary ==========
console.log(`\n========== Results: ${passed} passed, ${failed} failed ==========`);
process.exit(failed > 0 ? 1 : 0);
