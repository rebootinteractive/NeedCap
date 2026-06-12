import type { LevelData, ColorKey, PlacedPiece } from '../shared/types';
import { COLOR_KEYS, COLOR_CSS } from '../shared/colors';
import { GLOBAL_CHARGE } from '../game/config';
import {
  GRID_COLS,
  gridRows,
  totalCounts,
  containerFromQueues,
  defaultClusteredLayout,
  layoutMatches,
} from '../shared/containerLayout';
import { saveCustomLevel } from '../ui/storage';
import { ContainerGrid } from './ContainerGrid';

export interface EditorCallbacks {
  initial?: LevelData;
  onExit: () => void;
  onTestPlay: (lv: LevelData) => void;
}

export class EditorApp {
  private root: HTMLDivElement;
  private id: string;
  private name: string;
  private deckSlots: number;
  private queues: ColorKey[][]; // each queue = list of box colours, front first
  private newColor: ColorKey = 'red';

  private layout: PlacedPiece[] | null = null;
  private layoutSig = '';

  private stage: 1 | 2 = 1;
  private grid: ContainerGrid | null = null;

  // shell
  private titleEl!: HTMLDivElement;
  private backEl!: HTMLButtonElement;
  private statusEl!: HTMLDivElement;
  private bodyEl!: HTMLDivElement;
  private bottomEl!: HTMLDivElement;
  private modalEl: HTMLDivElement | null = null;

  constructor(private parent: HTMLElement, private cb: EditorCallbacks) {
    const init = cb.initial;
    this.id = init?.id?.startsWith('custom-') ? init.id : `custom-${Date.now()}`;
    this.name = init?.name ?? 'New Level';
    this.deckSlots = init?.deckSlots ?? 4;
    this.queues = (init?.queues ?? [{ boxes: [] }]).map((q) => q.boxes.map((b) => b.color));
    if (this.queues.length === 0) this.queues = [[]];
    this.layout = init?.layout ?? null;

    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.style.background = 'linear-gradient(160deg, #1c1f2a 0%, #131520 100%)';
    parent.appendChild(this.root);
    this.buildShell();
    this.showStage1();
  }

  // ---- shell ----------------------------------------------------------------

  private buildShell() {
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'title';
    this.backEl = document.createElement('button');
    this.backEl.className = 'tool-btn';
    this.backEl.addEventListener('click', () => this.onBack());
    toolbar.append(this.titleEl, this.backEl);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'editor-status';

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'editor-body';

    this.bottomEl = document.createElement('div');
    this.bottomEl.className = 'editor-bottom';

    this.root.append(toolbar, this.statusEl, this.bodyEl, this.bottomEl);
  }

  private onBack() {
    if (this.stage === 2) this.showStage1();
    else this.cb.onExit();
  }

  // ---- stage 1: queues ------------------------------------------------------

  private sig(): string {
    return JSON.stringify({ d: this.deckSlots, q: this.queues });
  }

  private showStage1() {
    if (this.grid) {
      this.captureLayout(); // preserve the arrangement when stepping back
      this.grid.dispose();
      this.grid = null;
    }
    this.stage = 1;
    this.titleEl.textContent = 'Editor · 1. Queues';
    this.backEl.textContent = '← Menu';
    this.bodyEl.style.display = '';
    this.bodyEl.style.overflowY = '';
    this.bodyEl.style.padding = '';
    this.bodyEl.innerHTML = '';
    this.bottomEl.innerHTML = '';

    // Deck slots + name
    const card0 = el('div', 'ed-card');
    const r0 = el('div', 'ed-row');
    const nlbl = el('span', 'ed-label', 'Name');
    const nameInput = document.createElement('input');
    nameInput.className = 'mini-num';
    nameInput.style.width = '150px';
    nameInput.value = this.name;
    nameInput.addEventListener('input', () => (this.name = nameInput.value));
    const dlbl = el('span', 'ed-label', 'Deck slots');
    const dInp = numInput(this.deckSlots, 1, 8, (v) => (this.deckSlots = v));
    r0.append(nlbl, nameInput, dlbl, dInp);
    card0.append(r0);

    // colour picker
    const picker = el('div', 'ed-card');
    const prow = el('div', 'ed-row');
    const plabel = el('span', 'ed-label', 'Box colour');
    const colorRow = el('div', 'color-row');
    for (const c of COLOR_KEYS) {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (c === this.newColor ? ' active' : '');
      dot.style.background = COLOR_CSS[c];
      dot.addEventListener('click', () => {
        this.newColor = c;
        colorRow
          .querySelectorAll('.color-dot')
          .forEach((d, i) => d.classList.toggle('active', COLOR_KEYS[i] === c));
      });
      colorRow.appendChild(dot);
    }
    prow.append(plabel, colorRow, el('span', 'ed-label', `each box needs ${GLOBAL_CHARGE} balls`));
    picker.append(prow);

    const deckSec = section('Setup', () => card0);
    const queuesSec = section('Queues (front box = leftmost)', () => {
      const wrap = el('div');
      wrap.appendChild(picker);
      this.queues.forEach((q, qi) => wrap.appendChild(this.queueCard(q, qi)));
      const addQ = btn('+ Add Queue', 'tool-btn', () => {
        this.queues.push([]);
        this.showStage1();
      });
      addQ.style.marginTop = '4px';
      wrap.appendChild(addQ);
      return wrap;
    });
    this.bodyEl.append(deckSec, queuesSec, this.containerSummary());

    const next = btn('Next: Arrange container →', 'btn small', () => this.goStage2());
    next.style.flex = '1';
    this.bottomEl.append(next);

    this.updateStage1Status();
  }

  private queueCard(q: ColorKey[], qi: number): HTMLElement {
    const card = el('div', 'ed-card');
    const row = el('div', 'ed-row');
    row.append(el('span', 'ed-label', `Q${qi + 1}`));

    const chips = el('div', 'queue-chips');
    q.forEach((color, bi) => {
      const chip = document.createElement('div');
      chip.className = 'chip removable';
      chip.style.background = COLOR_CSS[color];
      chip.textContent = String(GLOBAL_CHARGE);
      chip.title = `${color} · needs ${GLOBAL_CHARGE} balls (click to remove)`;
      chip.addEventListener('click', () => {
        q.splice(bi, 1);
        this.showStage1();
      });
      chips.appendChild(chip);
    });
    if (q.length === 0) {
      const empty = el('span', '', 'empty');
      empty.style.color = 'var(--muted)';
      empty.style.fontSize = '12px';
      chips.appendChild(empty);
    }

    const addBox = btn('+ box', 'tool-btn', () => {
      q.push(this.newColor);
      this.showStage1();
    });
    const delQ = btn('✕', 'tool-btn', () => {
      this.queues.splice(qi, 1);
      if (this.queues.length === 0) this.queues = [[]];
      this.showStage1();
    });
    row.append(chips, addBox, delQ);
    card.append(row);
    return card;
  }

  private containerSummary(): HTMLElement {
    return section('Container (auto — derived from queues)', () => {
      const wrap = el('div', 'ed-card');
      const container = containerFromQueues(this.queuesDef(), GLOBAL_CHARGE);
      if (container.length === 0) {
        wrap.append(el('span', 'ed-label', 'No boxes yet.'));
        return wrap;
      }
      for (const c of container) {
        const row = el('div', 'ed-row');
        const dot = document.createElement('div');
        dot.className = 'color-dot active';
        dot.style.background = COLOR_CSS[c.color];
        dot.style.cursor = 'default';
        row.append(dot, el('span', 'ed-label', `${c.balls} balls · ${c.caps} caps`));
        wrap.append(row);
      }
      const { balls, caps } = totalCounts(container);
      wrap.append(el('span', 'ed-label', `Total: ${balls} balls + ${caps} caps`));
      return wrap;
    });
  }

  private updateStage1Status() {
    const total = this.queues.reduce((a, q) => a + q.length, 0);
    this.statusEl.classList.remove('ok', 'bad');
    if (total === 0) {
      this.statusEl.classList.add('bad');
      this.statusEl.textContent = 'Add at least one box to a queue, then arrange the container.';
    } else {
      this.statusEl.classList.add('ok');
      this.statusEl.textContent = `${total} boxes across ${this.queues.length} queues · charge ${GLOBAL_CHARGE}`;
    }
  }

  // ---- stage 2: container grid ----------------------------------------------

  private goStage2() {
    const total = this.queues.reduce((a, q) => a + q.length, 0);
    if (total === 0) {
      this.statusEl.classList.add('bad');
      this.statusEl.textContent = 'Add at least one box first.';
      return;
    }
    const container = containerFromQueues(this.queuesDef(), GLOBAL_CHARGE);
    // reuse the saved layout only if stage 1 is unchanged and it still matches
    const reuse = this.layout && this.sig() === this.layoutSig && layoutMatches(this.layout, container);
    if (!reuse) {
      this.layout = defaultClusteredLayout(container);
      this.layoutSig = this.sig();
    }
    this.showStage2(container);
  }

  private showStage2(container = containerFromQueues(this.queuesDef(), GLOBAL_CHARGE)) {
    this.stage = 2;
    this.titleEl.textContent = 'Editor · 2. Container';
    this.backEl.textContent = '← Queues';
    this.bodyEl.innerHTML = '';
    this.bottomEl.innerHTML = '';
    this.bodyEl.style.display = 'flex';
    this.bodyEl.style.flexDirection = 'column';
    this.bodyEl.style.overflowY = 'hidden';
    this.bodyEl.style.padding = '8px';
    this.statusEl.classList.remove('bad');
    this.statusEl.classList.add('ok');
    this.statusEl.textContent =
      'Drag empty space to marquee-select balls · drag a selection or a cap to move · drops auto-arrange.';

    const { balls, caps } = totalCounts(container);
    const rows = gridRows(balls, caps);
    this.grid = new ContainerGrid(this.bodyEl, this.layout ?? defaultClusteredLayout(container), GRID_COLS, rows);

    const test = btn('▶ Test', 'btn small', () => this.cb.onTestPlay(this.snapshot()));
    const copy = btn('Copy JSON', 'btn ghost small', () => this.showJson());
    const dl = btn('↓ Download', 'btn ghost small', () => this.downloadJson());
    const save = btn('Save', 'btn small', () => this.save());
    this.bottomEl.append(test, copy, dl, save);
  }

  private captureLayout() {
    if (this.grid) {
      this.layout = this.grid.getLayout();
      this.layoutSig = this.sig();
    }
  }

  // ---- snapshot / persistence ----------------------------------------------

  private queuesDef() {
    return this.queues.map((q) => ({ boxes: q.map((color) => ({ color, charge: GLOBAL_CHARGE })) }));
  }

  private snapshot(): LevelData {
    if (this.stage === 2) this.captureLayout();
    const container = containerFromQueues(this.queuesDef(), GLOBAL_CHARGE);
    const layout = this.layout && layoutMatches(this.layout, container) ? this.layout : defaultClusteredLayout(container);
    return {
      id: this.id,
      name: this.name.trim() || 'Untitled',
      deckSlots: this.deckSlots,
      queues: this.queuesDef(),
      container,
      layout,
    };
  }

  private save() {
    saveCustomLevel(this.snapshot());
    this.flash('Saved to “Your Levels”.');
  }

  private downloadJson() {
    const lv = this.snapshot();
    const json = JSON.stringify(lv, null, 2);
    const slug =
      (lv.name || lv.id || 'level').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'level';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.flash('Downloaded — drop into src/levels/contributed/ to ship it.');
  }

  private showJson() {
    if (this.modalEl) return;
    const modal = el('div', 'modal');
    const card = el('div', 'modal-card');
    card.innerHTML = '<h2>Level JSON</h2><p>Copy and save as a .json file.</p>';
    const ta = document.createElement('textarea');
    ta.className = 'json';
    ta.value = JSON.stringify(this.snapshot(), null, 2);
    ta.readOnly = true;
    const actions = el('div', 'modal-actions');
    actions.appendChild(
      btn('Close', 'btn ghost', () => {
        modal.remove();
        this.modalEl = null;
      }),
    );
    card.append(ta, actions);
    modal.appendChild(card);
    this.root.appendChild(modal);
    this.modalEl = modal;
    ta.focus();
    ta.select();
  }

  private flash(msg: string) {
    this.statusEl.classList.remove('bad');
    this.statusEl.classList.add('ok');
    const prev = this.statusEl.textContent;
    this.statusEl.textContent = msg;
    window.setTimeout(() => {
      if (this.statusEl.textContent === msg) this.statusEl.textContent = prev;
    }, 2200);
  }

  dispose() {
    this.modalEl?.remove();
    this.modalEl = null;
    this.grid?.dispose();
    this.grid = null;
    this.root.remove();
  }
}

// ---- small DOM helpers ------------------------------------------------------

function el(tag: string, cls = '', text = ''): HTMLDivElement {
  const e = document.createElement(tag) as HTMLDivElement;
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function btn(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function numInput(value: number, min: number, max: number, onChange: (v: number) => void): HTMLInputElement {
  const inp = document.createElement('input');
  inp.className = 'mini-num';
  inp.type = 'number';
  inp.min = String(min);
  inp.max = String(max);
  inp.value = String(value);
  inp.addEventListener('input', () => {
    let v = parseInt(inp.value, 10);
    if (Number.isNaN(v)) return;
    v = Math.max(min, Math.min(max, v));
    onChange(v);
  });
  return inp;
}

function section(title: string, build: () => HTMLElement): HTMLElement {
  const s = el('div', 'ed-section');
  const h = document.createElement('h3');
  h.textContent = title;
  s.appendChild(h);
  s.appendChild(build());
  return s;
}
