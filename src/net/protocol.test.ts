import { describe, it, expect } from 'vitest';
import { encodeInput, decodeInput, encodeState, decodeState } from './protocol';
import type { InputFrame, StateSnapshot } from '../types';

describe('Protocol: Input messages', () => {
  it('round-trips input encoding and decoding', () => {
    const input: InputFrame = { dx: 0.5, dy: -0.3, kick: true };
    const buf = encodeInput(42, input);
    const decoded = decodeInput(buf);

    expect(decoded).not.toBeNull();
    expect(decoded!.seq).toBe(42);
    expect(decoded!.input.dx).toBeCloseTo(0.5);
    expect(decoded!.input.dy).toBeCloseTo(-0.3);
    expect(decoded!.input.kick).toBe(true);
  });

  it('round-trips input with no kick', () => {
    const input: InputFrame = { dx: -1.0, dy: 1.0, kick: false };
    const buf = encodeInput(0, input);
    const decoded = decodeInput(buf);

    expect(decoded).not.toBeNull();
    expect(decoded!.input.kick).toBe(false);
  });

  it('round-trips zero input', () => {
    const input: InputFrame = { dx: 0, dy: 0, kick: false };
    const buf = encodeInput(1000, input);
    const decoded = decodeInput(buf);

    expect(decoded).not.toBeNull();
    expect(decoded!.seq).toBe(1000);
    expect(decoded!.input.dx).toBe(0);
    expect(decoded!.input.dy).toBe(0);
  });

  it('returns null for too-small buffer', () => {
    const buf = new ArrayBuffer(5);
    expect(decodeInput(buf)).toBeNull();
  });

  it('returns null for wrong message type', () => {
    const buf = new ArrayBuffer(12);
    const view = new DataView(buf);
    view.setUint8(0, 99); // wrong type
    expect(decodeInput(buf)).toBeNull();
  });

  it('encodes input as exactly 12 bytes', () => {
    const buf = encodeInput(0, { dx: 1, dy: 1, kick: true });
    expect(buf.byteLength).toBe(12);
  });
});

describe('Protocol: State messages', () => {
  function makeSnapshot(playerCount: number): StateSnapshot {
    const players = [];
    for (let i = 0; i < playerCount; i++) {
      players.push({
        id: i,
        team: (i % 2 === 0 ? 'red' : 'blue') as 'red' | 'blue',
        onField: true,
        benchedAtTick: i * 100,
        kickCooldown: i,
        position: { x: 100 + i * 10, y: 200 + i * 5 },
        velocity: { x: i * 0.1, y: -i * 0.2 },
        name: `Player ${i}`,
      });
    }
    return {
      tick: 1234,
      matchTime: 250.5,
      phase: 'playing',
      kickoffCountdown: 0,
      scoreRed: 3,
      scoreBlue: 2,
      halfSwapped: false,
      lastSubstitutionTime: 240,
      players,
      ball: {
        position: { x: 420, y: 200 },
        velocity: { x: 5.5, y: -3.2 },
      },
      timestamp: 0,
    };
  }

  it('round-trips state with 8 players', () => {
    const snapshot = makeSnapshot(8);
    const buf = encodeState(7, snapshot);
    const decoded = decodeState(buf);

    expect(decoded).not.toBeNull();
    expect(decoded!.seq).toBe(7);

    const s = decoded!.snapshot;
    expect(s.tick).toBe(1234);
    expect(s.matchTime).toBeCloseTo(250.5);
    expect(s.phase).toBe('playing');
    expect(s.scoreRed).toBe(3);
    expect(s.scoreBlue).toBe(2);
    expect(s.halfSwapped).toBe(false);
    expect(s.players).toHaveLength(8);
    expect(s.ball.position.x).toBeCloseTo(420);
    expect(s.ball.velocity.y).toBeCloseTo(-3.2);
  });

  it('preserves player data through round-trip', () => {
    const snapshot = makeSnapshot(4);
    const buf = encodeState(0, snapshot);
    const decoded = decodeState(buf);
    const s = decoded!.snapshot;

    for (let i = 0; i < 4; i++) {
      const orig = snapshot.players[i];
      const dec = s.players[i];
      expect(dec.id).toBe(orig.id);
      expect(dec.team).toBe(orig.team);
      expect(dec.onField).toBe(orig.onField);
      expect(dec.benchedAtTick).toBe(orig.benchedAtTick);
      expect(dec.kickCooldown).toBe(orig.kickCooldown);
      expect(dec.position.x).toBeCloseTo(orig.position.x);
      expect(dec.position.y).toBeCloseTo(orig.position.y);
      expect(dec.velocity.x).toBeCloseTo(orig.velocity.x);
      expect(dec.velocity.y).toBeCloseTo(orig.velocity.y);
    }
  });

  it('round-trips all match phases', () => {
    const phases = ['kickoff', 'playing', 'halftime', 'overtime', 'ended'] as const;
    for (const phase of phases) {
      const snapshot = makeSnapshot(2);
      snapshot.phase = phase;
      const buf = encodeState(0, snapshot);
      const decoded = decodeState(buf);
      expect(decoded!.snapshot.phase).toBe(phase);
    }
  });

  it('round-trips halftime state', () => {
    const snapshot = makeSnapshot(2);
    snapshot.halfSwapped = true;
    snapshot.kickoffCountdown = 120;
    const buf = encodeState(0, snapshot);
    const decoded = decodeState(buf);
    expect(decoded!.snapshot.halfSwapped).toBe(true);
    expect(decoded!.snapshot.kickoffCountdown).toBe(120);
  });

  it('handles zero players', () => {
    const snapshot = makeSnapshot(0);
    const buf = encodeState(0, snapshot);
    const decoded = decodeState(buf);
    expect(decoded!.snapshot.players).toHaveLength(0);
  });

  it('returns null for too-small buffer', () => {
    const buf = new ArrayBuffer(10);
    expect(decodeState(buf)).toBeNull();
  });

  it('returns null for wrong message type', () => {
    const buf = new ArrayBuffer(100);
    const view = new DataView(buf);
    view.setUint8(0, 99);
    expect(decodeState(buf)).toBeNull();
  });

  it('state message size matches expected formula', () => {
    for (const count of [0, 1, 4, 8, 14]) {
      const snapshot = makeSnapshot(count);
      const buf = encodeState(0, snapshot);
      // Header(21) + playerCount(1) + ball(16) + players(24 each)
      expect(buf.byteLength).toBe(21 + 1 + 16 + count * 24);
    }
  });
});
