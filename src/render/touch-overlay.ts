import {
  isTouchDevice,
  getJoystickStateP1,
  getJoystickStateP2,
  JoystickState,
} from '../input/input';
import { RED_TEAM_COLOR, BLUE_TEAM_COLOR } from '../constants';

const JOYSTICK_RADIUS = 50;
const KICK_BUTTON_RADIUS = 40;

/** Draw a single joystick + kick button pair. */
function drawControls(
  ctx: CanvasRenderingContext2D,
  js: JoystickState,
  defaultJX: number,
  kickX: number,
  h: number,
  teamColor: string,
  label: string,
): void {
  const dpr = devicePixelRatio;
  const jx = js.active ? js.originX * dpr : defaultJX;
  const jy = js.active ? js.originY * dpr : h * 0.7;

  // Outer ring
  ctx.beginPath();
  ctx.arc(jx, jy, JOYSTICK_RADIUS * dpr, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fill();
  ctx.strokeStyle = teamColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Inner knob
  const knobR = 20 * dpr;
  const knobX = jx + js.dx * JOYSTICK_RADIUS * dpr;
  const knobY = jy + js.dy * JOYSTICK_RADIUS * dpr;
  ctx.beginPath();
  ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();

  // Kick button
  const ky = h * 0.7;
  const kr = KICK_BUTTON_RADIUS * dpr;

  ctx.beginPath();
  ctx.arc(kickX, ky, kr, 0, Math.PI * 2);
  ctx.fillStyle = js.kick ? teamColor : 'rgba(255, 255, 255, 0.15)';
  ctx.globalAlpha = js.kick ? 0.5 : 1;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = teamColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = js.kick ? 0.7 : 0.3;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Kick label
  ctx.font = `bold ${14 * dpr}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, kickX, ky);
}

/** Draw touch controls overlay for both players. */
export function renderTouchOverlay(ctx: CanvasRenderingContext2D): void {
  if (!isTouchDevice()) return;

  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // P1: joystick at 12.5%, kick at 37.5%
  drawControls(ctx, getJoystickStateP1(), w * 0.125, w * 0.375, h, RED_TEAM_COLOR, 'KICK');

  // P2: joystick at 62.5%, kick at 87.5%
  drawControls(ctx, getJoystickStateP2(), w * 0.625, w * 0.875, h, BLUE_TEAM_COLOR, 'KICK');

  // Divider line
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.55);
  ctx.lineTo(w / 2, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}
