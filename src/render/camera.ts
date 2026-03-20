import { FIELD_WIDTH, FIELD_HEIGHT, CANVAS_PADDING } from '../constants';

export interface Camera {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// Extra space for HUD elements above (score panel) and below (timer, bench)
const HUD_TOP = 44;
const HUD_BOTTOM = 40;

/** Calculate scale and offset so the field + HUD fits the canvas with padding. */
export function fitCamera(canvasWidth: number, canvasHeight: number): Camera {
  const availW = canvasWidth - CANVAS_PADDING * 2;
  const availH = canvasHeight - CANVAS_PADDING * 2;

  // Total drawable height includes HUD areas
  const totalH = FIELD_HEIGHT + HUD_TOP + HUD_BOTTOM;
  const scale = Math.min(availW / FIELD_WIDTH, availH / totalH);

  const offsetX = (canvasWidth - FIELD_WIDTH * scale) / 2;
  // Center the total area (field + HUD), then offset so field starts below HUD
  const offsetY = (canvasHeight - totalH * scale) / 2 + HUD_TOP * scale;

  return { scale, offsetX, offsetY };
}

/** Resize the canvas to fill the window with devicePixelRatio support. Returns the camera. */
export function resizeCanvas(canvas: HTMLCanvasElement): Camera {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  return fitCamera(canvas.width, canvas.height);
}
