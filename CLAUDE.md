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
  main.ts            — Entry point
  constants.ts       — All magic numbers
  types.ts           — Shared type definitions
  physics/           — Game simulation (engine, collision, field)
  render/            — Canvas 2D drawing (renderer, hud, camera)
  net/               — PeerJS networking (host, client, protocol, lobby)
  input/             — Keyboard/mouse input capture
  game/              — Game loops (host + client), rules, state
  ui/                — DOM-based UI (lobby, HUD, screens)
  util/              — Vec2 math helpers
```

## Conventions

- All physics constants live in `src/constants.ts` — no magic numbers in logic files
- Types shared between host and client go in `src/types.ts`
- Binary protocol definitions in `src/net/protocol.ts`
- Host is authoritative — clients never mutate game state directly
- Player avatars are unicorns with team-colored circles
- Run `npm run check` before committing to ensure formatting, lint, and types pass
