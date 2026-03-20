import { TICK_DURATION } from './constants';
import { createGameState, simulateTick } from './physics/engine';
import { render } from './render/renderer';
import { resizeCanvas } from './render/camera';
import { initInput, readInput } from './input/input';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let camera = resizeCanvas(canvas);
window.addEventListener('resize', () => {
  camera = resizeCanvas(canvas);
});

initInput();

// Create a local sandbox game: 1 red player vs 1 blue (dummy)
const state = createGameState(1, 1);

// --- Fixed timestep game loop ---
let lastTime = performance.now();
let accumulator = 0;

function loop(now: number): void {
  const dt = now - lastTime;
  lastTime = now;
  accumulator += dt;

  while (accumulator >= TICK_DURATION) {
    const input = readInput();
    const inputs = new Map<number, import('./types').InputFrame>();
    inputs.set(0, input); // Player 0 = the local human player

    simulateTick(state, inputs);
    accumulator -= TICK_DURATION;
  }

  render(ctx, state, camera);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
