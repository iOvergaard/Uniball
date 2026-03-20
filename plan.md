# Uniball — Implementation Plan

## Context

We're building **Uniball**, a browser-based P2P multiplayer soccer game inspired by haxball.com, focused purely on soccer. It's a team activity where two teams of up to 7 players each compete, with a maximum of 4 on the field per team at any time. Reserve players rotate in via forced substitutions every 60 seconds. The game uses WebRTC (via PeerJS) so one player's browser acts as the authoritative host — no traditional backend needed.

## Technology Stack

- **Language**: TypeScript (strict mode)
- **Toolchain**: Vite+ (Vite 8, Vitest, Oxlint, Oxfmt)
- **Networking**: PeerJS (WebRTC DataChannels) — free cloud signaling server
- **Rendering**: HTML Canvas 2D
- **Physics**: Custom circle-based collision (no library)
- **Architecture**: Host/leader pattern (one peer = authoritative game server)
- **CI/CD**: GitHub Actions → GitHub Pages

## Current File Structure

### Root config files

- `CLAUDE.md` — Project conventions, build/test/lint commands, links to `plan.md`
- `plan.md` — This implementation plan for team reference
- `package.json` — deps: `vite-plus`, `peerjs`
- `vite.config.ts` — Unified Vite+ config (build, test, lint, fmt)
- `index.html` — Single `<canvas>`, script tag
- `.github/workflows/deploy.yml` — GitHub Pages deploy on push to main

### Source tree (`src/`)

```
src/
  main.ts                  — Entry point, game loop, local sandbox
  constants.ts             — All magic numbers (field, physics, timings, substitution)
  types.ts                 — Shared type definitions
  physics/
    engine.ts              — Fixed-timestep simulation, substitution logic
    engine.test.ts         — Vitest test suite (27 unit tests)
    collision.ts           — Circle-circle and circle-wall resolution
    field.ts               — Field geometry, goal detection, player positioning
  render/
    renderer.ts            — Canvas 2D drawing (field, unicorns, ball, HUD, animations, overlays)
    renderer.test.ts       — 11 tests: state snapshots at key moments, camera fitting
    camera.ts              — Viewport scaling / DPR / HUD-aware resize
  net/                     — PeerJS networking
    host.ts                — Host: accept connections, run physics, broadcast state, disconnect handling
    client.ts              — Client: send inputs, receive state, interpolate
    protocol.ts            — Binary message encoding/decoding (input: 12B, state: ~230B)
    protocol.test.ts       — 14 tests for binary round-trip encoding
    lobby.test.ts          — 13 tests for lobby flow and multi-player simulation
    robustness.test.ts     — 10 tests for disconnect handling, input buffering, late-join
  input/
    input.ts               — Keyboard capture → InputFrame
  game/                    — (Phase 4) Separate game loops
    game-host.ts           — Host game loop: tick physics + broadcast
    game-client.ts         — Client game loop: send inputs + interpolate + render
    rules.ts               — Kickoff, halftime, goals, game-over logic
    state.ts               — GameState factory functions
  ui/                      — DOM-based UI
    lobby-ui.ts            — Lobby screens (landing, host lobby, client lobby, player list)
    screens.ts             — Disconnect overlay
  util/
    math.ts                — Vec2 helpers (add, sub, scale, length, normalize, dot, dist)
```

## Architecture

### Host/Client Model (not deterministic lockstep)

- **Host** runs authoritative physics at **60 Hz** fixed timestep
- **Clients** send input (direction + kick) to host every tick (~12 bytes)
- **Host** broadcasts compact **state snapshots at 20 Hz** (~230 bytes for 8 on-field players)
- **Clients** interpolate between the two most recent snapshots for smooth 60fps rendering

This avoids cross-browser floating-point determinism issues that plague lockstep.

### Network Protocol (binary over unreliable DataChannel)

**Client → Host (every tick):**
| Field | Type | Bytes |
|-------|------|-------|
| type | uint8 | 1 |
| seq | uint16 | 2 |
| dx | float32 | 4 |
| dy | float32 | 4 |
| kick | uint8 | 1 |
| **Total** | | **12** |

**Host → All (20 Hz):**
| Field | Type | Bytes |
|-------|------|-------|
| Header (type, seq, tick, time, scores) | mixed | 13 |
| Per player (id, team, onField, benchedAtTick, cooldown, pos, vel) | mixed | 24 each |
| **Total (8 on-field)** | | **~230** |

Bandwidth: ~3.6 KB/s per client. Negligible.

**Lobby messages**: Reliable JSON over a separate PeerJS DataConnection (join, team change, start game, chat).

### Physics Model

All entities are circles. Top-down, no gravity, friction via damping.

| Entity | Radius | Mass | Damping/tick |
| ------ | ------ | ---- | ------------ |
| Player | 15     | 1.0  | 0.96         |
| Ball   | 10     | 0.5  | 0.99         |

### Substitution System

- Up to **14 players** total (7 per team max), **4 on field per team** at a time
- Teams can be unequal in size (e.g. 7 red vs 3 blue)
- Every **60 seconds**, each team with reserves performs a forced substitution
- Rotation is FIFO: the first on-field player goes to bench, the longest-waiting reserve comes on (tracked via `benchedAtTick`)
- After substitution, all on-field players reset to starting positions

### Player Avatars — Unicorns!

Each player is rendered as a **unicorn** emoji/icon inside their circle. Teams are distinguished by color (red team = warm-toned unicorns, blue team = cool-toned unicorns). Each player gets a unique color shade within their team so they're individually identifiable. The unicorn faces the direction of movement. Options for rendering:

- **Simple**: Draw the 🦄 emoji on the canvas at each player's position (with `fillText`), tinted by team color via a colored circle behind it
- **Better**: Small hand-drawn unicorn sprite (SVG or PNG) in ~8 color variants, rotated to face movement direction

We'll start with the emoji approach in Phase 1-4 and can upgrade to custom sprites in Phase 5.

- **Movement**: Input direction × PLAYER_ACCEL → add to velocity, clamp to MAX_SPEED, damp
- **Kick**: Within range + cooldown=0 → impulse on ball from player→ball direction × KICK_FORCE. Cooldown = 15 ticks
- **Collisions**: Standard elastic circle-circle. Circle-wall = push back + reflect velocity
- **Goals**: Ball center enters goal area → score

**Field**: 840×400 game units, goals 10×120 centered on left/right edges.

### Game Rules

- **5 minutes** match, halftime at 2:30 (swap sides, teleport players)
- **Kickoff** after each goal: players to starting positions, ball centered, 3-2-1-GO countdown
- **Forced substitution** every 60s if team has reserves
- **Game over** at timer=0. Tie = draw (or optional sudden death overtime)

### Lobby Flow

1. Host: `new Peer()` → gets `peerId` → shareable URL `#room=<peerId>`
2. Client: reads `room` from URL hash → `peer.connect(roomId)`
3. Team selection in lobby (Red/Blue, max 7 per team)
4. Host clicks Start → `GameStart` message → all transition to game

## Implementation Phases

### Phase 1: Scaffolding + Local Physics Sandbox — DONE

Created Vite+TS project, physics engine, renderer, input handling. One player + ball on a field, controllable with WASD, ball bounces off walls. Migrated to Vite+ toolchain (Vite 8, Vitest, Oxlint, Oxfmt). Added GitHub Pages deploy workflow.

### Phase 2: Full Local Match — DONE

Added scoring, timer, kickoff countdown, halftime side swap, game-over logic. Implemented reserve player system with forced substitutions every 60 seconds (max 4 on field per team, up to 14 total players). HUD shows score, timer, and bench counts. Two-player local play: Player 1 (WASD + Space) controls Red, Player 2 (Arrow keys + Enter) controls Blue.

**Test**: Play a full local match. Goals register, score updates, halftime swaps sides, substitutions rotate players, game ends.

### Phase 3: Networking — Host + One Client — DONE

PeerJS integration. Host runs physics at 60 Hz, broadcasts state snapshots at 20 Hz via binary protocol. Client sends input (12 bytes) and interpolates between snapshots for smooth 60fps rendering. Mode detection via URL hash: `#host` creates room, `#room=<id>` joins as client, no hash = local 2-player mode.

**Test**: Two browser tabs connected. Both players move, kick ball. Physics authoritative on host tab.

### Phase 4: Lobby + Multi-Player — DONE

Full lobby UI: landing screen (create/join/local), host lobby with shareable link, team picker, player list with team columns. Client lobby with team switching. Disconnect screen. Refactored main.ts to route through lobby UI before game start. 13 new lobby tests covering player management, team assignment, 4-8 player game simulations with invariants, state broadcast round-trips, and substitution with network players.

**Test**: Multiple tabs join room, pick teams, host starts game, everyone plays together. Substitutions rotate reserves in.

### Phase 5: Visual Polish — DONE

Complete visual overhaul: hand-drawn unicorn avatars (horn, head, rainbow mane) rotated to face movement direction with unique color shades per player. Kick expanding ring animation + cooldown bar + kick range indicator. Goal flash with "GOAL!" text and team color overlay. Improved kickoff countdown with pulsing effect and dim overlay. Halftime announcement ("HALFTIME" in gold). Substitution announcement. Polished field with grass stripes, penalty areas, corner arcs, net pattern goals. Gradient player circles and ball with soccer pentagon pattern and speed glow. Player name labels with rounded background. Game-over screen with winner color and final score. Responsive camera with DPR support and HUD margin accounting. 11 new snapshot/camera tests (82 total).

**Test**: Game looks polished and feels fun in a group.

### Phase 6: Robustness & Graceful Degradation — DONE

Comprehensive disconnect handling and graceful degradation:

- **Player leaves mid-game**: `removePlayer()` in engine removes the player from the game state. If the team has reserves, the longest-waiting reserve is immediately subbed in. If not, the team plays short-handed. All players see a "[Player] left the game" notification toast (auto-dismisses after 3s). Host broadcasts `playerLeft` message to all clients.
- **Host disconnects**: Clients already detect via WebRTC `close` event and show "Host left — game over" screen. No recovery needed (host is authoritative). Host now broadcasts final state before stopping so clients see the game-over screen.
- **Input buffering**: Host tracks `inputAge` per client. When no new input arrives, the host replays the client's last known input for up to `INPUT_BUFFER_TICKS` (10 ticks / ~167ms). After the buffer expires, the client's input is treated as zero (no movement/kick). This smooths over brief network hiccups.
- **Late join prevention**: Once the match starts (`running = true`), join requests are rejected with a `rejected` message containing the reason. Clients see "Rejected: Match already in progress".
- **Input listener cleanup**: `initInput()` now stores references to all event listeners. `destroyInput()` removes them cleanly. `initInput()` also cleans up previous listeners if called multiple times.
- **Final state broadcast**: Host broadcasts state one last time before stopping the tick loop, ensuring clients receive the `phase='ended'` state.
- **Unequal teams after leave**: Game continues with any number of players per team, even 0. No forced forfeits.

**Test**: 10 new tests covering: player removal with/without reserves, reserve substitution on disconnect, unequal teams after leave, removing all players from a team, input buffering behavior, late-join prevention invariant, full 30-second match with mid-game disconnects and per-tick invariant checks.

### Phase 7: Gameplay & Polish Enhancements — DONE

- **Sudden death overtime**: Tied regulation score triggers a 60-second overtime period with golden goal (first goal wins). If no goals in overtime, match ends as draw. `inOvertime` flag on GameState, renderer shows "SUDDEN DEATH" announcement and red "OT" timer prefix.
- **Lobby chat**: Real-time text chat in both host and client lobbies. Chat messages relayed through host to all clients via `chat` LobbyMessage type. Chat box with scrollable message history and send button/Enter key.
- **Sound effects**: Procedural Web Audio API sound effects — kick blip, goal whistle (ascending notes), kickoff whistle, countdown tick, game-over fanfare, ball bounce. M key toggles mute. No external audio files.
- **Performance optimization**: Mutable Vec2 operations (`vec2AddMut`, `vec2ScaleMut`, `vec2ClampMut`) in physics hot loop to reduce GC pressure. Inline active player iteration. Reusable ball collision object.
- **Custom unicorn sprites**: Pre-rendered unicorn sprites via offscreen canvas cache. Each player color gets a cached sprite with horn, head, ear, eye highlight, nostril, flowing rainbow mane, and team color ring. Blitted via `drawImage` instead of redrawing paths every frame.

**Test**: 4 new tests covering: overtime on tied score, golden goal in overtime, draw after overtime expires, acceptance test for tied match entering sudden death.

## Key Types (`src/types.ts`)

```typescript
type Team = 'red' | 'blue';
interface Vec2 {
  x: number;
  y: number;
}
interface PlayerState {
  id: number;
  position: Vec2;
  velocity: Vec2;
  team: Team;
  kickCooldown: number;
  name: string;
  onField: boolean;
  benchedAtTick: number;
}
interface BallState {
  position: Vec2;
  velocity: Vec2;
}
type MatchPhase = 'kickoff' | 'playing' | 'halftime' | 'overtime' | 'ended';
interface GameState {
  tick: number;
  matchTime: number;
  phase: MatchPhase;
  kickoffCountdown: number;
  scoreRed: number;
  scoreBlue: number;
  players: PlayerState[];
  ball: BallState;
  halfSwapped: boolean;
  lastSubstitutionTime: number;
  inOvertime: boolean;
}
interface InputFrame {
  dx: number;
  dy: number;
  kick: boolean;
}
```

## Verification

1. **Phase 1**: `npm run dev` → open browser → move player with WASD, kick ball with Space
2. **Phase 2**: Two players on same keyboard, play full match with timer and substitutions
3. **Phase 3**: Open two tabs, connect via URL hash, both control separate players
4. **Phase 4**: Open 4+ tabs, join lobby, pick teams, start and play match with reserves
5. **Phase 5**: Visual inspection — field lines, colors, animations, responsive scaling
6. **Phase 6**: Close a tab mid-game, verify graceful handling
7. **Phase 7**: Play a tied match → verify overtime triggers, chat in lobby, sounds on kick/goal, M to mute

## Testing Policy

**Testing is a prerequisite for all work.** No feature is complete until it has automated tests. All tests run on every PR via CI (`npm run test`).

### Test Structure

- `src/physics/engine.test.ts` — 30 unit tests for physics, collisions, scoring, timer, substitutions, overtime
- `src/test/acceptance.test.ts` — 18 acceptance tests: full match simulations with bot players, invariant checks every tick, overtime
- `src/net/protocol.test.ts` — 14 binary protocol round-trip tests
- `src/net/lobby.test.ts` — 13 lobby flow and multi-player game simulation tests
- `src/render/renderer.test.ts` — 11 state snapshot and camera fitting tests
- `src/net/robustness.test.ts` — 10 robustness tests: disconnect handling, input buffering, late-join prevention

**Total: 96 tests**

### Acceptance Tests

Bot-driven full match simulations that exercise the entire engine end-to-end. Each test:

1. Creates a game with scripted "bot" players (chase-ball, attack, idle)
2. Runs the match for 30 seconds of game time (fast — ~13s wall time for all 16 tests)
3. Asserts **invariants on every tick**: positions finite, players in bounds, team limits, non-negative scores/time
4. Checks outcomes: match completes, goals scored, halftime triggers, substitutions rotate

Current acceptance coverage (18 tests):

- Full match completion: 1v1, 3v3, 5v5 (with reserves), asymmetric teams
- Goal scoring: attackers score at least 1 goal
- Halftime: triggers once, swaps sides
- Substitutions: reserves rotate onto field after interval, fair rotation (all reserves get field time)
- Ball physics: velocity bounded, Y position in bounds
- Player collisions: overlap rate below 5%
- Edge cases: idle players, constant kicking, diagonal movement
- Overtime: tied match enters sudden death, completes correctly

### Per-Phase Testing Requirements

- **Phase 3 (Networking)**: Mock PeerJS transport with in-memory message passing. Test host→client state broadcast, client→host input round-trip, interpolation convergence.
- **Phase 4 (Lobby)**: Simulate multiple clients joining lobby, picking teams, host starting match. Full game with 4+ simulated players.
- **Phase 5 (Polish)**: Snapshot-test game state at key moments (goal, halftime, substitution). No visual tests.
- **Phase 6 (Robustness)**: Disconnect mid-game triggers reserve sub-in. Host disconnect ends game for all. Reconnect within grace period resumes.

### CI Pipeline

- **PR checks** (`.github/workflows/ci.yml`): format + lint + types + tests + build
- **Deploy** (`.github/workflows/deploy.yml`): build only (checks already passed on PR)

## Estimated Size

~2000-2500 lines of TypeScript. Largest files: `engine.ts` (~250), `renderer.ts` (~250), `game-host.ts` (~150), `lobby-ui.ts` (~200).
