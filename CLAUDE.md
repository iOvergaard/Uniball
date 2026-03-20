# Uniball

Browser-based P2P multiplayer soccer game inspired by haxball.com. Unicorn-themed!

## Plan

See [plan.md](./plan.md) for the full implementation plan, architecture decisions, and phased roadmap.

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Toolchain**: Vite+ (Vite 8, Vitest, Oxlint, Oxfmt)
- **Networking**: PeerJS (WebRTC DataChannels, P2P)
- **Rendering**: HTML Canvas 2D
- **Physics**: Custom circle-based collision
- **Architecture**: Host/leader pattern — no backend server

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run tests (Vitest)
npm run lint         # Lint (Oxlint)
npm run fmt          # Format (Oxfmt)
npm run check        # All checks: fmt + lint + types
```

## Project Structure

```
src/
  main.ts            — Entry point, mode routing (local/host/client)
  constants.ts       — All magic numbers (field, physics, timing, networking)
  types.ts           — Shared type definitions (game state, networking, lobby)
  physics/           — Game simulation (engine, collision, field)
    engine.ts        — Fixed-timestep physics, substitution, scoring
    engine.test.ts   — 27 unit tests
    collision.ts     — Circle-circle and circle-wall resolution
    field.ts         — Field geometry, goal detection, positioning
  render/            — Canvas 2D drawing
    renderer.ts      — Field, unicorn avatars, ball, HUD, animations, overlays
    renderer.test.ts — 11 snapshot + camera tests
    camera.ts        — Viewport scaling, DPR, HUD-aware resize
    touch-overlay.ts — Touch joystick controls
  net/               — PeerJS networking
    host.ts          — Host: connections, physics loop, state broadcast, disconnect handling
    client.ts        — Client: input send, state receive, interpolation
    protocol.ts      — Binary encoding/decoding (input 12B, state ~230B)
    protocol.test.ts — 14 round-trip tests
    lobby.test.ts    — 13 lobby + multiplayer simulation tests
    robustness.test.ts — 10 disconnect/buffering/late-join tests
  input/             — Keyboard/touch input capture
  ui/                — DOM-based UI
    lobby-ui.ts      — Landing, host lobby, client lobby screens
    screens.ts       — Disconnect + game-over overlays + notification toasts
  test/              — Acceptance tests
    acceptance.test.ts — 17 bot-driven full match simulations
  util/              — Vec2 math helpers
```

## Conventions

- All physics constants live in `src/constants.ts` — no magic numbers in logic files
- Types shared between host and client go in `src/types.ts`
- Binary protocol definitions in `src/net/protocol.ts`
- Host is authoritative — clients never mutate game state directly
- Player avatars are hand-drawn unicorns (horn, head, rainbow mane) with team-colored circles
- Renderer animation state resets automatically on new match (tick-based detection)
- Engine never sets phase='halftime' — halftime is detected via halfSwapped transition
- `removePlayer()` in engine handles mid-game disconnects with automatic reserve sub-in
- Host input buffering: replays last input for `INPUT_BUFFER_TICKS` on packet loss
- Late-join prevention: host rejects join requests after match starts
- Input listeners are cleaned up via `destroyInput()` — no leaked listeners
- Run `npm run check` before committing to ensure formatting, lint, and types pass
