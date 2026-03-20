/** DOM-based overlay screens for game events */

let overlay: HTMLDivElement | null = null;

function getOverlay(): HTMLDivElement {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'game-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:50;pointer-events:none;font-family:sans-serif;color:#fff;';
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function showDisconnected(): void {
  const el = getOverlay();
  el.style.pointerEvents = 'auto';
  el.style.background = 'rgba(0,0,0,0.8)';
  el.innerHTML = `
    <div style="text-align:center;">
      <h2 style="font-size:32px;margin-bottom:12px;">Disconnected</h2>
      <p style="opacity:0.7;margin-bottom:20px;">The host has left the game.</p>
      <button onclick="location.hash='';location.reload()"
        style="padding:12px 24px;font-size:16px;border:none;border-radius:8px;background:#457b9d;color:#fff;cursor:pointer;">
        Back to Menu
      </button>
    </div>
  `;
}

export function showGameOver(): void {
  const el = getOverlay();
  el.style.pointerEvents = 'auto';
  // Position at bottom center, transparent background (canvas draws the game-over text)
  el.style.background = 'none';
  el.style.alignItems = 'flex-end';
  el.style.paddingBottom = '60px';
  el.innerHTML = `
    <button onclick="location.hash='';location.reload()"
      style="padding:12px 24px;font-size:16px;border:none;border-radius:8px;background:rgba(69,123,157,0.9);color:#fff;cursor:pointer;">
      Back to Menu
    </button>
  `;
}

export function hideOverlay(): void {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

/** Show a brief notification toast (auto-dismisses after 3 seconds). */
export function showNotification(message: string): void {
  const toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
    'padding:10px 20px;background:rgba(0,0,0,0.8);color:#fff;border-radius:8px;' +
    'font-family:sans-serif;font-size:14px;z-index:60;pointer-events:none;' +
    'transition:opacity 0.5s;opacity:1;';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}
