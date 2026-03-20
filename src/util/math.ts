import { Vec2 } from '../types';

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Normalize(v: Vec2): Vec2 {
  const len = vec2Length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vec2Dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function vec2Dist(a: Vec2, b: Vec2): number {
  return vec2Length(vec2Sub(a, b));
}

export function vec2Lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function vec2Clone(v: Vec2): Vec2 {
  return { x: v.x, y: v.y };
}

// --- Mutable variants (reduce allocations in hot loops) ---

/** a += b (mutates a) */
export function vec2AddMut(a: Vec2, b: Vec2): void {
  a.x += b.x;
  a.y += b.y;
}

/** v *= s (mutates v) */
export function vec2ScaleMut(v: Vec2, s: number): void {
  v.x *= s;
  v.y *= s;
}

/** Set v to its normalized form (mutates v). Returns length. */
export function vec2NormalizeMut(v: Vec2): number {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return 0;
  v.x /= len;
  v.y /= len;
  return len;
}

/** Clamp v's magnitude to max (mutates v) */
export function vec2ClampMut(v: Vec2, max: number): void {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len > max) {
    v.x = (v.x / len) * max;
    v.y = (v.y / len) * max;
  }
}
