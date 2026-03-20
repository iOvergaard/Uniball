import { InputFrame } from '../types';

const keys = new Set<string>();

export function initInput(): void {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });
  // Prevent keys sticking when window loses focus
  window.addEventListener('blur', () => {
    keys.clear();
  });
}

/** Read current input state for WASD + Space controls. */
export function readInput(): InputFrame {
  let dx = 0;
  let dy = 0;

  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

  const kick = keys.has('Space') || keys.has('Enter');

  return { dx, dy, kick };
}
