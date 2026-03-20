import type { GameState, PlayerState } from '../types';
import type { Camera } from './camera';
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  GOAL_Y_MIN,
  CENTER_CIRCLE_RADIUS,
  PLAYER_RADIUS,
  BALL_RADIUS,
  KICK_RANGE,
  KICK_COOLDOWN_TICKS,
  RED_TEAM_COLOR,
  BLUE_TEAM_COLOR,
  RED_TEAM_LIGHT,
  BLUE_TEAM_LIGHT,
  FIELD_LINE_COLOR,
} from '../constants';

// === Animation state (transient visual effects) ===

interface AnimState {
  prevScoreRed: number;
  prevScoreBlue: number;
  prevPhase: string;
  prevLastSubTime: number;
  goalFlashTimer: number;
  goalFlashTeam: 'red' | 'blue' | null;
  halftimeTimer: number;
  subAnnouncementTimer: number;
  initialized: boolean;
}

const anim: AnimState = {
  prevScoreRed: 0,
  prevScoreBlue: 0,
  prevPhase: '',
  prevLastSubTime: 0,
  goalFlashTimer: 0,
  goalFlashTeam: null,
  halftimeTimer: 0,
  subAnnouncementTimer: 0,
  initialized: false,
};

const GOAL_FLASH_DURATION = 60; // frames
const HALFTIME_DISPLAY_DURATION = 120;
const SUB_ANNOUNCEMENT_DURATION = 90;

function detectEvents(state: GameState): void {
  if (!anim.initialized) {
    anim.prevScoreRed = state.scoreRed;
    anim.prevScoreBlue = state.scoreBlue;
    anim.prevPhase = state.phase;
    anim.prevLastSubTime = state.lastSubstitutionTime;
    anim.initialized = true;
    return;
  }

  // Goal scored
  if (state.scoreRed > anim.prevScoreRed) {
    anim.goalFlashTimer = GOAL_FLASH_DURATION;
    anim.goalFlashTeam = 'red';
  } else if (state.scoreBlue > anim.prevScoreBlue) {
    anim.goalFlashTimer = GOAL_FLASH_DURATION;
    anim.goalFlashTeam = 'blue';
  }

  // Halftime started
  if (state.phase === 'halftime' && anim.prevPhase !== 'halftime') {
    anim.halftimeTimer = HALFTIME_DISPLAY_DURATION;
  }

  // Substitution happened
  if (state.lastSubstitutionTime !== anim.prevLastSubTime && anim.prevLastSubTime > 0) {
    anim.subAnnouncementTimer = SUB_ANNOUNCEMENT_DURATION;
  }

  anim.prevScoreRed = state.scoreRed;
  anim.prevScoreBlue = state.scoreBlue;
  anim.prevPhase = state.phase;
  anim.prevLastSubTime = state.lastSubstitutionTime;
}

function tickAnimations(): void {
  if (anim.goalFlashTimer > 0) anim.goalFlashTimer--;
  if (anim.halftimeTimer > 0) anim.halftimeTimer--;
  if (anim.subAnnouncementTimer > 0) anim.subAnnouncementTimer--;
}

// === Main render ===

export function render(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
  detectEvents(state);
  tickAnimations();

  const { scale, offsetX, offsetY } = camera;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Background (beyond field)
  ctx.fillStyle = '#1a3a2a';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawField(ctx);
  drawBall(ctx, state);
  drawPlayers(ctx, state);
  drawGoalFlash(ctx);
  drawHUD(ctx, state);
  drawOverlays(ctx, state);

  ctx.restore();
}

// === Field ===

function drawField(ctx: CanvasRenderingContext2D): void {
  // Grass with subtle gradient
  const grad = ctx.createLinearGradient(0, 0, 0, FIELD_HEIGHT);
  grad.addColorStop(0, '#2d6a4f');
  grad.addColorStop(0.5, '#245a42');
  grad.addColorStop(1, '#2d6a4f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Grass stripes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  const stripeW = FIELD_WIDTH / 12;
  for (let i = 0; i < 12; i += 2) {
    ctx.fillRect(i * stripeW, 0, stripeW, FIELD_HEIGHT);
  }

  ctx.strokeStyle = FIELD_LINE_COLOR;
  ctx.lineWidth = 2;

  // Boundary
  ctx.strokeRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Center line
  ctx.beginPath();
  ctx.moveTo(FIELD_WIDTH / 2, 0);
  ctx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = FIELD_LINE_COLOR;
  ctx.beginPath();
  ctx.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Penalty areas (proportional to field)
  const penW = 60;
  const penH = 200;
  const penY = (FIELD_HEIGHT - penH) / 2;
  ctx.strokeRect(0, penY, penW, penH);
  ctx.strokeRect(FIELD_WIDTH - penW, penY, penW, penH);

  // Corner arcs
  const cornerR = 15;
  ctx.beginPath();
  ctx.arc(0, 0, cornerR, 0, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(FIELD_WIDTH, 0, cornerR, Math.PI / 2, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(FIELD_WIDTH, FIELD_HEIGHT, cornerR, Math.PI, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, FIELD_HEIGHT, cornerR, Math.PI * 1.5, Math.PI * 2);
  ctx.stroke();

  // Goals
  // Left goal (red scores here when halfSwapped=false, or blue when halfSwapped)
  drawGoal(ctx, -GOAL_WIDTH, GOAL_Y_MIN, GOAL_WIDTH, GOAL_HEIGHT, 'left');
  // Right goal
  drawGoal(ctx, FIELD_WIDTH, GOAL_Y_MIN, GOAL_WIDTH, GOAL_HEIGHT, 'right');
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  _side: 'left' | 'right',
): void {
  // Net pattern
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(x, y, w, h);

  // Net lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 0.5;
  const step = 8;
  for (let ny = y; ny <= y + h; ny += step) {
    ctx.beginPath();
    ctx.moveTo(x, ny);
    ctx.lineTo(x + w, ny);
    ctx.stroke();
  }
  for (let nx = x; nx <= x + w; nx += step) {
    ctx.beginPath();
    ctx.moveTo(nx, y);
    ctx.lineTo(nx, y + h);
    ctx.stroke();
  }

  // Frame
  ctx.strokeStyle = FIELD_LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

// === Ball ===

function drawBall(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { ball } = state;
  const x = ball.position.x;
  const y = ball.position.y;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 3, BALL_RADIUS, BALL_RADIUS * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball glow when moving fast
  const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
  if (speed > 5) {
    const glowAlpha = Math.min((speed - 5) / 10, 0.4);
    ctx.fillStyle = `rgba(255, 255, 200, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS + 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ball body
  const ballGrad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, BALL_RADIUS);
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(1, '#dddddd');
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Outline
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Soccer pattern (pentagon)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  const pr = BALL_RADIUS * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const px = x + Math.cos(a) * pr;
    const py = y + Math.sin(a) * pr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// === Players ===

// Unique color shades per player within team
const RED_SHADES = ['#e63946', '#ff4757', '#ff6b6b', '#c0392b', '#e74c3c', '#ff5252', '#d63031'];
const BLUE_SHADES = ['#457b9d', '#3498db', '#74c0fc', '#2980b9', '#5dade2', '#48dbfb', '#0984e3'];

function getPlayerColor(player: PlayerState): string {
  const shades = player.team === 'red' ? RED_SHADES : BLUE_SHADES;
  return shades[player.id % shades.length];
}

function drawPlayers(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const player of state.players.filter((p) => p.onField)) {
    drawPlayer(ctx, player, state);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState, _state: GameState): void {
  const x = player.position.x;
  const y = player.position.y;
  const color = getPlayerColor(player);
  const lightColor = player.team === 'red' ? RED_TEAM_LIGHT : BLUE_TEAM_LIGHT;

  // Kick range indicator (subtle) when cooldown is ready
  if (player.kickCooldown === 0) {
    ctx.strokeStyle = `${lightColor}33`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y, KICK_RANGE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Kick effect (expanding ring when just kicked)
  if (player.kickCooldown > KICK_COOLDOWN_TICKS - 5) {
    const t = (KICK_COOLDOWN_TICKS - player.kickCooldown) / 5;
    const kickR = PLAYER_RADIUS + t * 15;
    const alpha = 0.5 * (1 - t);
    ctx.strokeStyle = `${lightColor}`;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, kickR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 3, PLAYER_RADIUS, PLAYER_RADIUS * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Team-colored circle with gradient
  const bodyGrad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, PLAYER_RADIUS);
  bodyGrad.addColorStop(0, lightColor);
  bodyGrad.addColorStop(1, color);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw unicorn (rotated to face movement direction)
  drawUnicorn(ctx, player);

  // Player name with background
  const name = player.name || `P${player.id}`;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const nameY = y - PLAYER_RADIUS - 5;
  const nameMetrics = ctx.measureText(name);
  const nameW = nameMetrics.width + 6;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(x - nameW / 2, nameY - 10, nameW, 12, 3);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.fillText(name, x, nameY);

  // Cooldown bar (below player when on cooldown)
  if (player.kickCooldown > 0) {
    const barW = PLAYER_RADIUS * 2;
    const barH = 3;
    const barX = x - PLAYER_RADIUS;
    const barY = y + PLAYER_RADIUS + 4;
    const progress = 1 - player.kickCooldown / KICK_COOLDOWN_TICKS;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = lightColor;
    ctx.fillRect(barX, barY, barW * progress, barH);
  }
}

function drawUnicorn(ctx: CanvasRenderingContext2D, player: PlayerState): void {
  const x = player.position.x;
  const y = player.position.y;

  // Facing direction from velocity
  const vx = player.velocity.x;
  const vy = player.velocity.y;
  const speed = Math.sqrt(vx * vx + vy * vy);
  const angle = speed > 0.1 ? Math.atan2(vy, vx) : 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const r = PLAYER_RADIUS * 0.6;

  // Horn (pointing forward = right in local coords)
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(r + 5, 0);
  ctx.lineTo(r - 2, -3);
  ctx.lineTo(r - 2, 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#daa520';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Head
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(r * 0.3, -r * 0.25, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Mane (rainbow hair trailing behind)
  const maneColors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'];
  for (let i = 0; i < maneColors.length; i++) {
    ctx.strokeStyle = maneColors[i];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const startX = -r * 0.3;
    const startY = -r * 0.5 - i * 1.5;
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX - r * 0.5, startY - 2 + i * 1, startX - r, startY + i * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// === Goal flash ===

function drawGoalFlash(ctx: CanvasRenderingContext2D): void {
  if (anim.goalFlashTimer <= 0) return;

  const t = anim.goalFlashTimer / GOAL_FLASH_DURATION;
  const alpha = t * 0.3;
  const color = anim.goalFlashTeam === 'red' ? RED_TEAM_COLOR : BLUE_TEAM_COLOR;

  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillRect(-GOAL_WIDTH - 20, -40, FIELD_WIDTH + GOAL_WIDTH * 2 + 40, FIELD_HEIGHT + 80);
  ctx.globalAlpha = 1;

  // "GOAL!" text with team color
  if (anim.goalFlashTimer > GOAL_FLASH_DURATION / 2) {
    const textT = (anim.goalFlashTimer - GOAL_FLASH_DURATION / 2) / (GOAL_FLASH_DURATION / 2);
    const textScale = 1 + (1 - textT) * 0.3;
    ctx.save();
    ctx.translate(FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    ctx.scale(textScale, textScale);
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText('GOAL!', 2, 2);

    ctx.fillStyle = '#fff';
    ctx.globalAlpha = textT;
    ctx.fillText('GOAL!', 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// === HUD ===

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Score panel
  const panelW = 120;
  const panelH = 36;
  const panelX = FIELD_WIDTH / 2 - panelW / 2;
  const panelY = -40;

  // Panel background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 6);
  ctx.fill();

  // Team color accents
  ctx.fillStyle = RED_TEAM_COLOR;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW / 2, panelH, [6, 0, 0, 6]);
  ctx.globalAlpha = 0.15;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = BLUE_TEAM_COLOR;
  ctx.beginPath();
  ctx.roundRect(panelX + panelW / 2, panelY, panelW / 2, panelH, [0, 6, 6, 0]);
  ctx.globalAlpha = 0.15;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Scores
  ctx.font = 'bold 24px sans-serif';
  ctx.textBaseline = 'middle';
  const scoreY = panelY + panelH / 2;

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(`${state.scoreRed}`, FIELD_WIDTH / 2 - 8, scoreY);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(':', FIELD_WIDTH / 2, scoreY - 1);

  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.scoreBlue}`, FIELD_WIDTH / 2 + 8, scoreY);

  // Timer
  const minutes = Math.floor(state.matchTime / 60);
  const seconds = Math.floor(state.matchTime % 60);
  const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(timerText, FIELD_WIDTH / 2, FIELD_HEIGHT + 6);

  // Bench indicators
  const redReserves = state.players.filter((p) => p.team === 'red' && !p.onField).length;
  const blueReserves = state.players.filter((p) => p.team === 'blue' && !p.onField).length;
  if (redReserves > 0 || blueReserves > 0) {
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'top';
    if (redReserves > 0) {
      ctx.fillStyle = RED_TEAM_LIGHT;
      ctx.textAlign = 'left';
      ctx.fillText(`🦄 ×${redReserves} bench`, 4, FIELD_HEIGHT + 6);
    }
    if (blueReserves > 0) {
      ctx.fillStyle = BLUE_TEAM_LIGHT;
      ctx.textAlign = 'right';
      ctx.fillText(`bench ${blueReserves}× 🦄`, FIELD_WIDTH - 4, FIELD_HEIGHT + 6);
    }
  }
}

// === Overlays (kickoff countdown, halftime, game over, substitution) ===

function drawOverlays(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Kickoff countdown
  if (state.phase === 'kickoff') {
    const countdown = Math.ceil(state.kickoffCountdown / 60);
    const text = countdown > 0 ? `${countdown}` : 'GO!';
    const isGo = countdown <= 0;

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    // Countdown number
    ctx.font = `bold ${isGo ? 60 : 72}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const tickInSecond = state.kickoffCountdown % 60;
    const pulse = 1 + Math.sin(tickInSecond * 0.1) * 0.05;
    ctx.save();
    ctx.translate(FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    ctx.scale(pulse, pulse);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(text, 2, 2);

    // Text
    ctx.fillStyle = isGo ? '#4ade80' : '#fff';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // Halftime announcement
  if (anim.halftimeTimer > 0) {
    const t = anim.halftimeTimer / HALFTIME_DISPLAY_DURATION;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.globalAlpha = Math.min(t * 2, 1);
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    ctx.globalAlpha = 1;

    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText('HALFTIME', FIELD_WIDTH / 2 + 2, FIELD_HEIGHT / 2 + 2);
    ctx.fillStyle = '#feca57';
    ctx.globalAlpha = Math.min(t * 2, 1);
    ctx.fillText('HALFTIME', FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    ctx.globalAlpha = 1;
  }

  // Substitution announcement
  if (anim.subAnnouncementTimer > 0) {
    const t = anim.subAnnouncementTimer / SUB_ANNOUNCEMENT_DURATION;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#feca57';
    ctx.globalAlpha = Math.min(t * 3, 1);
    ctx.fillText('🔄 SUBSTITUTION', FIELD_WIDTH / 2, FIELD_HEIGHT + 22);
    ctx.globalAlpha = 1;
  }

  // Game over
  if (state.phase === 'ended') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    const winner =
      state.scoreRed > state.scoreBlue
        ? 'Red Wins!'
        : state.scoreBlue > state.scoreRed
          ? 'Blue Wins!'
          : 'Draw!';
    const winColor =
      state.scoreRed > state.scoreBlue
        ? RED_TEAM_LIGHT
        : state.scoreBlue > state.scoreRed
          ? BLUE_TEAM_LIGHT
          : '#fff';

    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(winner, FIELD_WIDTH / 2 + 2, FIELD_HEIGHT / 2 + 2);

    ctx.fillStyle = winColor;
    ctx.fillText(winner, FIELD_WIDTH / 2, FIELD_HEIGHT / 2);

    // Final score subtitle
    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(`${state.scoreRed} - ${state.scoreBlue}`, FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 35);
  }
}
