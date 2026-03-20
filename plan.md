# Uniball — Implementation Plan

## Context

We're building **Uniball**, a browser-based P2P multiplayer soccer game inspired by haxball.com, focused purely on soccer. It's a team activity where two teams of up to 5 play each other. The game uses WebRTC (via PeerJS) so one player's browser acts as the authoritative host — no traditional backend needed.

The repo is currently empty (just a LICENSE file). We're building from scratch.

## Technology Stack

- **Language**: TypeScript
- **Build tool**: Vite
- **Networking**: PeerJS (WebRTC DataChannels) — free cloud signaling server
- **Rendering**: HTML Canvas 2D
- **Physics**: Custom circle-based collision (no library)
- **Architecture**: Host/leader pattern (one peer = authoritative game server)

## Files to Create

### Root config files

- `CLAUDE.md` — Project conventions, build/test/lint commands, links to `plan.md`
- `plan.md` — This implementation plan for team reference
- `package.json` — deps: `vite`, `typescript`, `peerjs`
- `tsconfig.json` — strict, ESNext
- `vite.config.ts` — minimal
- `index.html` — single `<canvas>`, script tag

### Source tree (`src/`)

```
src/
  main.ts                  — Entry point, routes between lobby and game
  constants.ts             — All magic numbers (field size, physics, timings)
  types.ts                 — Shared type definitions
  physics/
    engine.ts              — Fixed-timestep simulation (the core loop)
    collision.ts           — Circle-circle and circle-wall resolution
    field.ts               — Field geometry, goal detection, boundaries
  render/
    renderer.ts            — Canvas 2D drawing (field, players, ball)
    hud.ts                 — Score, timer, overlays
    camera.ts              — Viewport scaling / resize handling
  net/
    host.ts                — Host: accept connections, broadcast state
    client.ts              — Client: send inputs, receive state, interpolate
    protocol.ts            — Binary message encoding/decoding
    lobby.ts               — Room creation, join flow, team selection
  input/
    input.ts               — Keyboard capture → InputFrame
  game/
    game-host.ts           — Host game loop: tick physics + broadcast
    game-client.ts         — Client game loop: send inputs + interpolate + render
    rules.ts               — Kickoff, halftime, goals, game-over logic
    state.ts               — GameState factory functions
  ui/
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
- **Host** broadcasts compact **state snapshots at 20 Hz** (~230 bytes for 10 players)
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
| Per player (pos, vel, team, cooldown, id) | mixed | 20 each |
| **Total (10 players)** | | **~230** |

Bandwidth: ~4.6 KB/s per client. Negligible.

**Lobby messages**: Reliable JSON over a separate PeerJS DataConnection (join, team change, start game, chat).

### Physics Model

All entities are circles. Top-down, no gravity, friction via damping.

| Entity | Radius | Mass | Damping/tick |
| ------ | ------ | ---- | ------------ |
| Player | 15     | 1.0  | 0.96         |
| Ball   | 10     | 0.5  | 0.99         |

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
- **Game over** at timer=0. Tie = draw (or optional sudden death overtime)

### Lobby Flow

1. Host: `new Peer()` → gets `peerId` → shareable URL `#room=<peerId>`
2. Client: reads `room` from URL hash → `peer.connect(roomId)`
3. Team selection in lobby (Red/Blue, max 5 per team)
4. Host clicks Start → `GameStart` message → all transition to game

## Implementation Phases

### Phase 1: Scaffolding + Local Physics Sandbox

Create Vite+TS project, physics engine, renderer, input handling. One player + ball on a field, controllable with WASD, ball bounces off walls.

**Test**: Open browser, move player, kick ball, see it bounce. Physics feels good.

### Phase 2: Full Local Match

Add multiple players, scoring, timer, kickoff, halftime, game-over. Two keyboard players (WASD vs arrows).

**Test**: Play a full local match. Goals register, score updates, halftime swaps sides, game ends.

### Phase 3: Networking — Host + One Client

PeerJS integration. Host runs physics, client sends input and receives state. Binary protocol. Client-side interpolation.

**Test**: Two browser tabs connected. Both players move, kick ball. Physics authoritative on host tab.

### Phase 4: Lobby + Multi-Player

Full lobby UI with shareable link, team selection, player names, ready-up. Support up to 10 players.

**Test**: Multiple tabs join room, pick teams, host starts game, everyone plays together.

### Phase 5: Visual Polish

Unicorn avatar upgrades (custom SVG sprites with team colors, rotation to face movement direction, kick animation), field lines, player names above unicorns, goal flash animation, kick indicator, responsive canvas scaling, kickoff countdown overlay, halftime overlay.

**Test**: Game looks polished and feels fun in a group.

### Phase 6: Robustness

Disconnect handling, late join prevention, input buffering on host (replay last input if packet lost), host disconnect → "Host left" screen.

**Test**: Disconnect a player mid-game — game continues. Kill host — clients see error screen.

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
}
interface InputFrame {
  dx: number;
  dy: number;
  kick: boolean;
}
```

## Verification

1. **Phase 1**: `npm run dev` → open browser → move player with WASD, kick ball with Space
2. **Phase 2**: Two players on same keyboard, play full match with timer
3. **Phase 3**: Open two tabs, connect via URL hash, both control separate players
4. **Phase 4**: Open 4+ tabs, join lobby, pick teams, start and play match
5. **Phase 5**: Visual inspection — field lines, colors, animations, responsive scaling
6. **Phase 6**: Close a tab mid-game, verify graceful handling

## Estimated Size

~2000-2500 lines of TypeScript. Largest files: `engine.ts` (~200), `renderer.ts` (~250), `game-host.ts` (~150), `lobby-ui.ts` (~200).
