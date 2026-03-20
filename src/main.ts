import { TICK_DURATION } from './constants';
import { createGameState, simulateTick } from './physics/engine';
import { render } from './render/renderer';
import { renderTouchOverlay } from './render/touch-overlay';
import { resizeCanvas } from './render/camera';
import { initInput, readInputP1, readInputP2 } from './input/input';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let camera = resizeCanvas(canvas);
window.addEventListener('resize', () => {
  camera = resizeCanvas(canvas);
});

initInput();

// Create a local 2-player game: P1 (WASD+Space) = Red, P2 (Arrows+Enter) = Blue
const state = createGameState(1, 1);

// --- Fixed timestep game loop ---
let lastTime = performance.now();
let accumulator = 0;

function loop(now: number): void {
  const dt = now - lastTime;
  lastTime = now;
  accumulator += dt;

  while (accumulator >= TICK_DURATION) {
    const inputs = new Map<number, import('./types').InputFrame>();
    inputs.set(0, readInputP1()); // Player 0 (Red) = WASD + Space
    inputs.set(1, readInputP2()); // Player 1 (Blue) = Arrows + Enter

    simulateTick(state, inputs);
    accumulator -= TICK_DURATION;
  }

  render(ctx, state, camera);
  renderTouchOverlay(ctx);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
