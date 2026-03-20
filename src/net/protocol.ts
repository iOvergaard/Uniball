import { MSG_INPUT, MSG_STATE } from '../constants';
import type { InputFrame, PlayerState, BallState, MatchPhase, StateSnapshot, Team } from '../types';

// === Input message: Client → Host (12 bytes) ===
// [ type:u8 | seq:u16 | dx:f32 | dy:f32 | kick:u8 ]
const INPUT_SIZE = 12;

export function encodeInput(seq: number, input: InputFrame): ArrayBuffer {
  const buf = new ArrayBuffer(INPUT_SIZE);
  const view = new DataView(buf);
  view.setUint8(0, MSG_INPUT);
  view.setUint16(1, seq, true);
  view.setFloat32(3, input.dx, true);
  view.setFloat32(7, input.dy, true);
  view.setUint8(11, input.kick ? 1 : 0);
  return buf;
}

export function decodeInput(buf: ArrayBuffer): { seq: number; input: InputFrame } | null {
  if (buf.byteLength < INPUT_SIZE) return null;
  const view = new DataView(buf);
  if (view.getUint8(0) !== MSG_INPUT) return null;
  return {
    seq: view.getUint16(1, true),
    input: {
      dx: view.getFloat32(3, true),
      dy: view.getFloat32(7, true),
      kick: view.getUint8(11) !== 0,
    },
  };
}

// === State message: Host → All ===
// Header (21 bytes):
//   [ type:u8 | seq:u16 | tick:u32 | matchTime:f32 | scoreRed:u8 | scoreBlue:u8 |
//     phase:u8 | kickoffCountdown:u16 | halfSwapped:u8 | lastSubTime:f32 ]
// Ball (16 bytes):
//   [ pos.x:f32 | pos.y:f32 | vel.x:f32 | vel.y:f32 ]
// Per player (22 bytes each):
//   [ id:u8 | team:u8 | onField:u8 | benchedAtTick:u32 | cooldown:u8 |
//     pos.x:f32 | pos.y:f32 | vel.x:f32 | vel.y:f32 ]
// Followed by player count: u8 after header+ball

const HEADER_SIZE = 22; // +1 byte for inOvertime flag
const BALL_SIZE = 16;
const PLAYER_SIZE = 24; // id:1 + team:1 + onField:1 + benchedAtTick:4 + cooldown:1 + pos:8 + vel:8

const PHASE_MAP: MatchPhase[] = ['kickoff', 'playing', 'halftime', 'overtime', 'ended'];

function phaseToU8(phase: MatchPhase): number {
  const idx = PHASE_MAP.indexOf(phase);
  return idx >= 0 ? idx : 0;
}

function u8ToPhase(v: number): MatchPhase {
  return PHASE_MAP[v] ?? 'playing';
}

export function encodeState(seq: number, snapshot: StateSnapshot): ArrayBuffer {
  const playerCount = snapshot.players.length;
  const size = HEADER_SIZE + 1 + BALL_SIZE + playerCount * PLAYER_SIZE;
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  let off = 0;

  // Header
  view.setUint8(off, MSG_STATE);
  off += 1;
  view.setUint16(off, seq, true);
  off += 2;
  view.setUint32(off, snapshot.tick, true);
  off += 4;
  view.setFloat32(off, snapshot.matchTime, true);
  off += 4;
  view.setUint8(off, snapshot.scoreRed);
  off += 1;
  view.setUint8(off, snapshot.scoreBlue);
  off += 1;
  view.setUint8(off, phaseToU8(snapshot.phase));
  off += 1;
  view.setUint16(off, snapshot.kickoffCountdown, true);
  off += 2;
  view.setUint8(off, snapshot.halfSwapped ? 1 : 0);
  off += 1;
  view.setFloat32(off, snapshot.lastSubstitutionTime, true);
  off += 4;
  view.setUint8(off, snapshot.inOvertime ? 1 : 0);
  off += 1;

  // Player count
  view.setUint8(off, playerCount);
  off += 1;

  // Ball
  view.setFloat32(off, snapshot.ball.position.x, true);
  off += 4;
  view.setFloat32(off, snapshot.ball.position.y, true);
  off += 4;
  view.setFloat32(off, snapshot.ball.velocity.x, true);
  off += 4;
  view.setFloat32(off, snapshot.ball.velocity.y, true);
  off += 4;

  // Players
  for (const p of snapshot.players) {
    view.setUint8(off, p.id);
    off += 1;
    view.setUint8(off, p.team === 'red' ? 0 : 1);
    off += 1;
    view.setUint8(off, p.onField ? 1 : 0);
    off += 1;
    view.setUint32(off, p.benchedAtTick, true);
    off += 4;
    view.setUint8(off, p.kickCooldown);
    off += 1;
    view.setFloat32(off, p.position.x, true);
    off += 4;
    view.setFloat32(off, p.position.y, true);
    off += 4;
    view.setFloat32(off, p.velocity.x, true);
    off += 4;
    view.setFloat32(off, p.velocity.y, true);
    off += 4;
  }

  return buf;
}

export function decodeState(buf: ArrayBuffer): { seq: number; snapshot: StateSnapshot } | null {
  if (buf.byteLength < HEADER_SIZE + 1 + BALL_SIZE) return null;
  const view = new DataView(buf);
  let off = 0;

  if (view.getUint8(off) !== MSG_STATE) return null;
  off += 1;
  const seq = view.getUint16(off, true);
  off += 2;
  const tick = view.getUint32(off, true);
  off += 4;
  const matchTime = view.getFloat32(off, true);
  off += 4;
  const scoreRed = view.getUint8(off);
  off += 1;
  const scoreBlue = view.getUint8(off);
  off += 1;
  const phase = u8ToPhase(view.getUint8(off));
  off += 1;
  const kickoffCountdown = view.getUint16(off, true);
  off += 2;
  const halfSwapped = view.getUint8(off) !== 0;
  off += 1;
  const lastSubstitutionTime = view.getFloat32(off, true);
  off += 4;
  const inOvertime = view.getUint8(off) !== 0;
  off += 1;

  const playerCount = view.getUint8(off);
  off += 1;

  // Ball
  const ball: BallState = {
    position: { x: view.getFloat32(off, true), y: view.getFloat32(off + 4, true) },
    velocity: { x: view.getFloat32(off + 8, true), y: view.getFloat32(off + 12, true) },
  };
  off += BALL_SIZE;

  // Players
  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    const id = view.getUint8(off);
    off += 1;
    const team: Team = view.getUint8(off) === 0 ? 'red' : 'blue';
    off += 1;
    const onField = view.getUint8(off) !== 0;
    off += 1;
    const benchedAtTick = view.getUint32(off, true);
    off += 4;
    const kickCooldown = view.getUint8(off);
    off += 1;
    const position = {
      x: view.getFloat32(off, true),
      y: view.getFloat32(off + 4, true),
    };
    off += 8;
    const velocity = {
      x: view.getFloat32(off, true),
      y: view.getFloat32(off + 4, true),
    };
    off += 8;

    players.push({ id, team, onField, benchedAtTick, kickCooldown, position, velocity, name: '' });
  }

  return {
    seq,
    snapshot: {
      tick,
      matchTime,
      phase,
      kickoffCountdown,
      scoreRed,
      scoreBlue,
      halfSwapped,
      lastSubstitutionTime,
      inOvertime,
      players,
      ball,
      timestamp: 0,
    },
  };
}
