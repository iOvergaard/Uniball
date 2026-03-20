import { FIELD_WIDTH, FIELD_HEIGHT, CANVAS_PADDING } from '../constants';

export interface Camera {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Calculate scale and offset so the field fits the canvas with padding. */
export function fitCamera(canvasWidth: number, canvasHeight: number): Camera {
  const availW = canvasWidth - CANVAS_PADDING * 2;
  const availH = canvasHeight - CANVAS_PADDING * 2;
  const scale = Math.min(availW / FIELD_WIDTH, availH / FIELD_HEIGHT);
  const offsetX = (canvasWidth - FIELD_WIDTH * scale) / 2;
  const offsetY = (canvasHeight - FIELD_HEIGHT * scale) / 2;
  return { scale, offsetX, offsetY };
}

/** Resize the canvas to fill the window. Returns the camera. */
export function resizeCanvas(canvas: HTMLCanvasElement): Camera {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  return fitCamera(canvas.width, canvas.height);
}
