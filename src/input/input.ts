import { InputFrame } from '../types';

// --- Keyboard state ---
const keys = new Set<string>();

// --- Touch state ---
let touchDx = 0;
let touchDy = 0;
let touchKick = false;
let joystickActive = false;
let joystickId: number | null = null;
let joystickOrigin = { x: 0, y: 0 };

const JOYSTICK_RADIUS = 50;
const JOYSTICK_DEAD_ZONE = 8;

export function initInput(): void {
  // Keyboard
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  // Touch
  if ('ontouchstart' in window) {
    initTouchControls();
  }
}

function initTouchControls(): void {
  // Prevent default touch behaviors (scrolling, zooming)
  document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  window.addEventListener('touchstart', handleTouchStart);
  window.addEventListener('touchmove', handleTouchMove);
  window.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('touchcancel', handleTouchEnd);
}

function handleTouchStart(e: TouchEvent): void {
  const w = window.innerWidth;

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];

    if (t.clientX < w / 2) {
      // Left half → joystick
      joystickId = t.identifier;
      joystickOrigin = { x: t.clientX, y: t.clientY };
      joystickActive = true;
      touchDx = 0;
      touchDy = 0;
    } else {
      // Right half → kick
      touchKick = true;
    }
  }
}

function handleTouchMove(e: TouchEvent): void {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];

    if (t.identifier === joystickId && joystickActive) {
      const dx = t.clientX - joystickOrigin.x;
      const dy = t.clientY - joystickOrigin.y;
      const dist = Math.hypot(dx, dy);

      if (dist < JOYSTICK_DEAD_ZONE) {
        touchDx = 0;
        touchDy = 0;
      } else {
        // Normalize to -1..1 range, clamped by joystick radius
        const clamped = Math.min(dist, JOYSTICK_RADIUS);
        touchDx = (dx / dist) * (clamped / JOYSTICK_RADIUS);
        touchDy = (dy / dist) * (clamped / JOYSTICK_RADIUS);
      }
    }
  }
}

function handleTouchEnd(e: TouchEvent): void {
  const w = window.innerWidth;

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];

    if (t.identifier === joystickId) {
      joystickActive = false;
      joystickId = null;
      touchDx = 0;
      touchDy = 0;
    }

    if (t.clientX >= w / 2) {
      touchKick = false;
    }
  }
}

/** Read current input state from keyboard + touch. */
export function readInput(): InputFrame {
  let dx = 0;
  let dy = 0;

  // Keyboard
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

  const keyKick = keys.has('Space') || keys.has('Enter');

  // Merge touch input (touch overrides if joystick is active)
  if (joystickActive) {
    dx = touchDx;
    dy = touchDy;
  }

  return { dx, dy, kick: keyKick || touchKick };
}

/** Whether touch controls are active (for rendering overlay). */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window;
}

/** Get joystick state for rendering the overlay. */
export function getJoystickState(): {
  active: boolean;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  kick: boolean;
} {
  return {
    active: joystickActive,
    originX: joystickOrigin.x,
    originY: joystickOrigin.y,
    dx: touchDx,
    dy: touchDy,
    kick: touchKick,
  };
}
