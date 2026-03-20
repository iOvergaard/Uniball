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
    engine.test.ts         — Vitest test suite (22 tests)
    collision.ts           — Circle-circle and circle-wall resolution
    field.ts               — Field geometry, goal detection, player positioning
  render/
    renderer.ts            — Canvas 2D drawing (field, players, ball, HUD, bench counts)
    camera.ts              — Viewport scaling / resize handling
  net/                     — (Phase 3) PeerJS networking
    host.ts                — Host: accept connections, broadcast state
    client.ts              — Client: send inputs, receive state, interpolate
    protocol.ts            — Binary message encoding/decoding
    lobby.ts               — Room creation, join flow, team selection
  input/
    input.ts               — Keyboard capture → InputFrame
  game/                    — (Phase 2-3) Separate game loops
    game-host.ts           — Host game loop: tick physics + broadcast
    game-client.ts         — Client game loop: send inputs + interpolate + render
    rules.ts               — Kickoff, halftime, goals, game-over logic
    state.ts               — GameState factory functions
  ui/                      — (Phase 4) DOM-based UI
    lobby-ui.ts            — Lobby screen (create/join, team pick, player list)
    hud-ui.ts              — In-game HUD
    screens.ts             — Game-over, halftime overlays
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
| Per player (pos, vel, team, cooldown, id, onField) | mixed | 21 each |
| **Total (8 on-field)** | | **~181** |

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
- Rotation is FIFO: the first on-field player goes to bench, the first reserve comes on
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

### Phase 3: Networking — Host + One Client

PeerJS integration. Host runs physics, client sends input and receives state. Binary protocol. Client-side interpolation.

**Test**: Two browser tabs connected. Both players move, kick ball. Physics authoritative on host tab.

### Phase 4: Lobby + Multi-Player

Full lobby UI with shareable link, team selection, player names, ready-up. Support up to 14 players (4 on field per team + reserves).

**Test**: Multiple tabs join room, pick teams, host starts game, everyone plays together. Substitutions rotate reserves in.

### Phase 5: Visual Polish

Unicorn avatar upgrades (custom SVG sprites with team colors, rotation to face movement direction, kick animation), field lines, player names above unicorns, goal flash animation, kick indicator, responsive canvas scaling, kickoff countdown overlay, halftime overlay, substitution announcement.

**Test**: Game looks polished and feels fun in a group.

### Phase 6: Robustness & Graceful Degradation

Handle all unintended/disruptive scenarios so the game continues smoothly:

- **Player leaves mid-game**: Remove player from field. If the team has reserves, immediately sub one in. If not, the team plays short-handed. Other players see a brief "[Player] left" notification.
- **Host disconnects**: All clients see a "Host left — game over" screen. No recovery (host is authoritative).
- **Client connection drops temporarily**: Host replays the client's last known input for up to N ticks (input buffering). If the client reconnects within a grace period, they resume seamlessly. If not, treated as a leave.
- **Late join prevention**: Once the match starts, no new players can join mid-game.
- **Tab/browser crash**: Same as disconnect — detected via WebRTC connection close event.
- **Unequal teams after leave**: Game continues even if one team has more players. No forced forfeits.

**Test**: Disconnect a player mid-game — reserve subs in or team plays short. Kill host — clients see error screen. Briefly kill network — player reconnects and resumes.

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

## Testing Policy

**Testing is a prerequisite for all work.** No feature is complete until it has automated tests. All tests run on every PR via CI (`npm run test`).

### Test Structure

- `src/physics/engine.test.ts` — Unit tests for physics, collisions, scoring, timer, substitutions
- `src/test/acceptance.test.ts` — Full match simulations with bot players, invariant checks every tick

### Acceptance Tests

Bot-driven full match simulations that exercise the entire engine end-to-end. Each test:

1. Creates a game with scripted "bot" players (chase-ball, attack, idle)
2. Runs the match for 30 seconds of game time (fast — ~13s wall time for all 16 tests)
3. Asserts **invariants on every tick**: positions finite, players in bounds, team limits, non-negative scores/time
4. Checks outcomes: match completes, goals scored, halftime triggers, substitutions rotate

Current acceptance coverage:

- Full match completion: 1v1, 3v3, 5v5 (with reserves), asymmetric teams
- Goal scoring: attackers score at least 1 goal
- Halftime: triggers once, swaps sides
- Substitutions: reserves rotate onto field after interval
- Ball physics: velocity bounded, Y position in bounds
- Player collisions: overlap rate below 5%
- Edge cases: idle players, constant kicking, diagonal movement

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
