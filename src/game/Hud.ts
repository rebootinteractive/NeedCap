export interface HudCallbacks {
  onRestart: () => void;
  onMenu: () => void;
  menuLabel: string;
}

/** HTML overlay: title + remaining counter, restart/menu buttons, win/lose modal. */
export class Hud {
  readonly root: HTMLDivElement;
  private counterEl: HTMLElement;
  private modalEl: HTMLDivElement | null = null;

  constructor(parent: HTMLElement, title: string, private cb: HudCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-title">${escapeHtml(title)}</div>
        <div class="hud-counter">Boxes left <strong id="hud-left">–</strong></div>
      </div>
      <div class="hud-bottom">
        <button class="btn ghost small" id="hud-menu">${escapeHtml(cb.menuLabel)}</button>
        <button class="btn ghost small" id="hud-restart">↻ Restart</button>
      </div>
    `;
    parent.appendChild(this.root);
    this.counterEl = this.root.querySelector('#hud-left')!;
    this.root.querySelector('#hud-restart')!.addEventListener('click', () => cb.onRestart());
    this.root.querySelector('#hud-menu')!.addEventListener('click', () => cb.onMenu());
  }

  setRemaining(n: number) {
    this.counterEl.textContent = String(n);
  }

  showEnd(win: boolean) {
    if (this.modalEl) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card endgame ${win ? 'win' : 'lose'}">
        <h1>${win ? 'Cleared!' : 'Stuck'}</h1>
        <p>${win ? 'Every queue emptied — nicely sorted.' : 'No box on the deck can finish. Deck deadlocked.'}</p>
        <div class="modal-actions">
          <button class="btn ghost" id="end-menu">${escapeHtml(this.cb.menuLabel)}</button>
          <button class="btn" id="end-restart">${win ? 'Play again' : 'Retry'}</button>
        </div>
      </div>`;
    this.root.appendChild(modal);
    this.modalEl = modal;
    modal.querySelector('#end-restart')!.addEventListener('click', () => this.cb.onRestart());
    modal.querySelector('#end-menu')!.addEventListener('click', () => this.cb.onMenu());
  }

  dispose() {
    this.modalEl?.remove();
    this.modalEl = null;
    this.root.remove();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
