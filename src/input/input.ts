import { InputFrame } from '../types';

// --- Keyboard state ---
const keys = new Set<string>();

// --- Touch state (per-player) ---
interface TouchPlayer {
  dx: number;
  dy: number;
  kick: boolean;
  joystickActive: boolean;
  joystickId: number | null;
  joystickOrigin: { x: number; y: number };
  kickTouchId: number | null;
}

function createTouchPlayer(): TouchPlayer {
  return {
    dx: 0,
    dy: 0,
    kick: false,
    joystickActive: false,
    joystickId: null,
    joystickOrigin: { x: 0, y: 0 },
    kickTouchId: null,
  };
}

const touchP1 = createTouchPlayer();
const touchP2 = createTouchPlayer();

const JOYSTICK_RADIUS = 50;
const JOYSTICK_DEAD_ZONE = 8;

// Store references for cleanup
let cleanupFn: (() => void) | null = null;

export function initInput(): void {
  // Clean up previous listeners if any
  if (cleanupFn) cleanupFn();

  const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onBlur = () => keys.clear();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  let touchCleanup: (() => void) | null = null;
  if ('ontouchstart' in window) {
    touchCleanup = initTouchControls();
  }

  cleanupFn = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    if (touchCleanup) touchCleanup();
    keys.clear();
  };
}

/** Remove all input listeners. */
export function destroyInput(): void {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

function initTouchControls(): () => void {
  const canvas = document.getElementById('game');

  // Only prevent default touch on the canvas (not on UI elements like inputs/buttons)
  const preventStart = (e: TouchEvent) => {
    if (e.target === canvas) e.preventDefault();
  };
  const preventMove = (e: TouchEvent) => {
    if (e.target === canvas) e.preventDefault();
  };
  document.addEventListener('touchstart', preventStart, { passive: false });
  document.addEventListener('touchmove', preventMove, { passive: false });

  window.addEventListener('touchstart', handleTouchStart);
  window.addEventListener('touchmove', handleTouchMove);
  window.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('touchcancel', handleTouchEnd);

  return () => {
    document.removeEventListener('touchstart', preventStart);
    document.removeEventListener('touchmove', preventMove);
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('touchcancel', handleTouchEnd);
  };
}

/**
 * Screen is split into 4 zones:
 *   [P1 joystick] [P1 kick] [P2 joystick] [P2 kick]
 *     0 - 25%      25 - 50%   50 - 75%     75 - 100%
 */
function getTouchZone(clientX: number): { player: TouchPlayer; action: 'joystick' | 'kick' } {
  const quarter = clientX / window.innerWidth;
  if (quarter < 0.25) return { player: touchP1, action: 'joystick' };
  if (quarter < 0.5) return { player: touchP1, action: 'kick' };
  if (quarter < 0.75) return { player: touchP2, action: 'joystick' };
  return { player: touchP2, action: 'kick' };
}

function handleTouchStart(e: TouchEvent): void {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const zone = getTouchZone(t.clientX);

    if (zone.action === 'joystick') {
      zone.player.joystickId = t.identifier;
      zone.player.joystickOrigin = { x: t.clientX, y: t.clientY };
      zone.player.joystickActive = true;
      zone.player.dx = 0;
      zone.player.dy = 0;
    } else {
      zone.player.kick = true;
      zone.player.kickTouchId = t.identifier;
    }
  }
}

function updateJoystick(player: TouchPlayer, clientX: number, clientY: number): void {
  const dx = clientX - player.joystickOrigin.x;
  const dy = clientY - player.joystickOrigin.y;
  const dist = Math.hypot(dx, dy);

  if (dist < JOYSTICK_DEAD_ZONE) {
    player.dx = 0;
    player.dy = 0;
  } else {
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    player.dx = (dx / dist) * (clamped / JOYSTICK_RADIUS);
    player.dy = (dy / dist) * (clamped / JOYSTICK_RADIUS);
  }
}

function handleTouchMove(e: TouchEvent): void {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];

    if (t.identifier === touchP1.joystickId && touchP1.joystickActive) {
      updateJoystick(touchP1, t.clientX, t.clientY);
    }
    if (t.identifier === touchP2.joystickId && touchP2.joystickActive) {
      updateJoystick(touchP2, t.clientX, t.clientY);
    }
  }
}

function handleTouchEnd(e: TouchEvent): void {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];

    for (const player of [touchP1, touchP2]) {
      if (t.identifier === player.joystickId) {
        player.joystickActive = false;
        player.joystickId = null;
        player.dx = 0;
        player.dy = 0;
      }
      if (t.identifier === player.kickTouchId) {
        player.kick = false;
        player.kickTouchId = null;
      }
    }
  }
}

/** Read Player 1 input: WASD + Space (+ left-side touch). */
export function readInputP1(): InputFrame {
  let dx = 0;
  let dy = 0;

  if (keys.has('KeyW')) dy -= 1;
  if (keys.has('KeyS')) dy += 1;
  if (keys.has('KeyA')) dx -= 1;
  if (keys.has('KeyD')) dx += 1;

  const keyKick = keys.has('Space');

  // Merge touch input (touch overrides if joystick is active)
  if (touchP1.joystickActive) {
    dx = touchP1.dx;
    dy = touchP1.dy;
  }

  return { dx, dy, kick: keyKick || touchP1.kick };
}

/** Read Player 2 input: Arrow keys + Enter (+ right-side touch). */
export function readInputP2(): InputFrame {
  let dx = 0;
  let dy = 0;

  if (keys.has('ArrowUp')) dy -= 1;
  if (keys.has('ArrowDown')) dy += 1;
  if (keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('ArrowRight')) dx += 1;

  const keyKick = keys.has('Enter');

  // Merge touch input
  if (touchP2.joystickActive) {
    dx = touchP2.dx;
    dy = touchP2.dy;
  }

  return { dx, dy, kick: keyKick || touchP2.kick };
}

/** Read combined input (for single-player / network). */
export function readInput(): InputFrame {
  const p1 = readInputP1();
  const p2 = readInputP2();
  return {
    dx: p1.dx || p2.dx,
    dy: p1.dy || p2.dy,
    kick: p1.kick || p2.kick,
  };
}

/** Whether touch controls are active (for rendering overlay). */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window;
}

export interface JoystickState {
  active: boolean;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  kick: boolean;
}

/** Get joystick state for P1 overlay. */
export function getJoystickStateP1(): JoystickState {
  return {
    active: touchP1.joystickActive,
    originX: touchP1.joystickOrigin.x,
    originY: touchP1.joystickOrigin.y,
    dx: touchP1.dx,
    dy: touchP1.dy,
    kick: touchP1.kick,
  };
}

/** Get joystick state for P2 overlay. */
export function getJoystickStateP2(): JoystickState {
  return {
    active: touchP2.joystickActive,
    originX: touchP2.joystickOrigin.x,
    originY: touchP2.joystickOrigin.y,
    dx: touchP2.dx,
    dy: touchP2.dy,
    kick: touchP2.kick,
  };
}
