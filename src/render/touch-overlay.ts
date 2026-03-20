import { isTouchDevice, getJoystickState } from '../input/input';

const JOYSTICK_RADIUS = 50;
const KICK_BUTTON_RADIUS = 40;

/** Draw touch controls overlay (joystick + kick button) directly on the canvas. */
export function renderTouchOverlay(ctx: CanvasRenderingContext2D): void {
  if (!isTouchDevice()) return;

  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const js = getJoystickState();

  // Save and reset transform so we draw in screen space
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // --- Joystick (left side) ---
  const jx = js.active ? js.originX * devicePixelRatio : w * 0.15;
  const jy = js.active ? js.originY * devicePixelRatio : h * 0.7;

  // Outer ring
  ctx.beginPath();
  ctx.arc(jx, jy, JOYSTICK_RADIUS * devicePixelRatio, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner knob
  const knobR = 20 * devicePixelRatio;
  const knobX = jx + js.dx * JOYSTICK_RADIUS * devicePixelRatio;
  const knobY = jy + js.dy * JOYSTICK_RADIUS * devicePixelRatio;
  ctx.beginPath();
  ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();

  // --- Kick button (right side) ---
  const kx = w * 0.85;
  const ky = h * 0.7;
  const kr = KICK_BUTTON_RADIUS * devicePixelRatio;

  ctx.beginPath();
  ctx.arc(kx, ky, kr, 0, Math.PI * 2);
  ctx.fillStyle = js.kick ? 'rgba(255, 100, 100, 0.5)' : 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
  ctx.strokeStyle = js.kick ? 'rgba(255, 100, 100, 0.7)' : 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Kick label
  ctx.font = `bold ${14 * devicePixelRatio}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KICK', kx, ky);

  ctx.restore();
}
