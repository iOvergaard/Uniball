/**
 * Procedural sound effects using Web Audio API.
 * No external audio files — all sounds are generated at runtime.
 */

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

export function setMuted(m: boolean): void {
  muted = m;
}

export function isMuted(): boolean {
  return muted;
}

/** Short blip for kick */
export function playKick(): void {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.frequency.setValueAtTime(600, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.08);
  gain.gain.setValueAtTime(0.15, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.08);
}

/** Whistle for goal */
export function playGoal(): void {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ac.currentTime);
  osc.frequency.setValueAtTime(1000, ac.currentTime + 0.15);
  osc.frequency.setValueAtTime(1200, ac.currentTime + 0.3);
  gain.gain.setValueAtTime(0.1, ac.currentTime);
  gain.gain.setValueAtTime(0.1, ac.currentTime + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.5);
}

/** Short whistle for kickoff */
export function playWhistle(): void {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(900, ac.currentTime);
  gain.gain.setValueAtTime(0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.3);
}

/** Countdown tick */
export function playCountdownTick(): void {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.frequency.setValueAtTime(440, ac.currentTime);
  gain.gain.setValueAtTime(0.08, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.05);
}

/** Game over fanfare */
export function playGameOver(): void {
  const ac = getCtx();
  if (!ac) return;
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  for (let i = 0; i < notes.length; i++) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(notes[i], ac.currentTime + i * 0.12);
    gain.gain.setValueAtTime(0, ac.currentTime + i * 0.12);
    gain.gain.linearRampToValueAtTime(0.1, ac.currentTime + i * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.25);
    osc.start(ac.currentTime + i * 0.12);
    osc.stop(ac.currentTime + i * 0.12 + 0.25);
  }
}

/** Ball bounce off wall */
export function playBounce(): void {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.04);
  gain.gain.setValueAtTime(0.06, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.04);
}
