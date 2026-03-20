/**
 * Pre-rendered unicorn sprites using offscreen canvas.
 * Each player gets a cached sprite based on their team color shade.
 * Sprites are drawn once and then blitted via drawImage for performance.
 */

import { PLAYER_RADIUS } from '../constants';

const SPRITE_SIZE = PLAYER_RADIUS * 4; // Canvas size for sprite (with padding)
const SPRITE_HALF = SPRITE_SIZE / 2;

// Cache: key = color hex, value = offscreen canvas
const spriteCache = new Map<string, HTMLCanvasElement>();

/** Get or create a cached unicorn sprite for a given color */
function getSprite(color: string, lightColor: string): HTMLCanvasElement {
  const key = color;
  if (spriteCache.has(key)) return spriteCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Draw at center of the sprite canvas, facing right (angle 0)
  ctx.translate(SPRITE_HALF, SPRITE_HALF);

  const r = PLAYER_RADIUS * 0.6;

  // Horn (pointing right = forward)
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(r + 6, 0);
  ctx.lineTo(r - 2, -3.5);
  ctx.lineTo(r - 2, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#daa520';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Head (white circle)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Ear
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.ellipse(r * 0.2, -r * 0.7, r * 0.2, r * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eye (larger, more expressive)
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(r * 0.35, -r * 0.2, 2, 0, Math.PI * 2);
  ctx.fill();
  // Eye highlight
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 0.27, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Nostril
  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  ctx.arc(r * 0.6, r * 0.15, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Rainbow mane (more flowing, thicker strands)
  const maneColors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'];
  for (let i = 0; i < maneColors.length; i++) {
    ctx.strokeStyle = maneColors[i];
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const startX = -r * 0.2;
    const startY = -r * 0.55 - i * 1.8;
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(
      startX - r * 0.4,
      startY - 3 + i * 1.2,
      startX - r * 0.8,
      startY + i * 1.5,
      startX - r * 1.1,
      startY + i * 2.5,
    );
    ctx.stroke();
  }

  // Team color ring around the sprite
  ctx.strokeStyle = lightColor;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  spriteCache.set(key, canvas);
  return canvas;
}

/**
 * Draw a cached unicorn sprite at the given position and angle.
 * Much faster than redrawing all the paths every frame.
 */
export function drawUnicornSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  lightColor: string,
): void {
  const sprite = getSprite(color, lightColor);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(sprite, -SPRITE_HALF, -SPRITE_HALF);
  ctx.restore();
}

/** Clear the sprite cache (e.g. on resize) */
export function clearSpriteCache(): void {
  spriteCache.clear();
}
