import type { LevelData, ColorKey, PlacedPiece, ContainerColor } from '../shared/types';
import { COLOR_KEYS, COLOR_CSS } from '../shared/colors';
import { GLOBAL_CHARGE } from '../game/config';
import {
  GRID_COLS,
  gridRows,
  totalCounts,
  containerFromQueues,
  defaultClusteredLayout,
  shuffledLayout,
  layoutMatches,
} from '../shared/containerLayout';
import { saveCustomLevel } from '../ui/storage';
import { ContainerGrid } from './ContainerGrid';
import { QueueBoard } from './QueueBoard';

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

  // stage 0 — recipe
  private boxCounts: Record<ColorKey, number>;
  private queueCount: number;

  // stage 1 — distribution
  private queues: ColorKey[][];
  private queuesSig = '';

  // stage 2 — layout
  private layout: PlacedPiece[] | null = null;
  private layoutSig = '';

  private stage: 0 | 1 | 2 = 0;
  private board: QueueBoard | null = null;
  private grid: ContainerGrid | null = null;
  private clustering = 1;

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

    this.boxCounts = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    for (const q of init?.queues ?? []) for (const b of q.boxes) this.boxCounts[b.color]++;
    if (this.totalBoxes() === 0) this.boxCounts.red = 2;
    this.queueCount = init?.queues?.length || 3;

    this.queues = (init?.queues ?? []).map((q) => q.boxes.map((b) => b.color));
    this.queuesSig = this.boxRecipeSig();
    this.layout = init?.layout ?? null;
    if (this.layout) this.layoutSig = this.distSig();

    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.style.background = 'linear-gradient(160deg, #1c1f2a 0%, #131520 100%)';
    parent.appendChild(this.root);
    this.buildShell();
    this.showStage0();
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
    else if (this.stage === 1) this.showStage0();
    else this.cb.onExit();
  }

  /** Capture work from the active dynamic component, then dispose it. */
  private teardownDynamic() {
    if (this.board) {
      this.queues = this.board.getQueues();
      this.queuesSig = this.boxRecipeSig();
      this.board.dispose();
      this.board = null;
    }
    if (this.grid) {
      this.layout = this.grid.getLayout();
      this.layoutSig = this.distSig();
      this.grid.dispose();
      this.grid = null;
    }
  }

  private prepBody(flex: boolean) {
    this.bodyEl.innerHTML = '';
    this.bottomEl.innerHTML = '';
    this.bodyEl.style.display = flex ? 'flex' : '';
    this.bodyEl.style.flexDirection = flex ? 'column' : '';
    this.bodyEl.style.overflowY = flex ? 'hidden' : '';
    this.bodyEl.style.padding = flex ? '8px' : '';
  }

  // ---- signatures + recipe helpers ------------------------------------------

  private boxRecipeSig(): string {
    return JSON.stringify({ q: this.queueCount, b: this.boxCounts });
  }
  private distSig(): string {
    return JSON.stringify(this.queues);
  }
  private totalBoxes(): number {
    return COLOR_KEYS.reduce((a, c) => a + this.boxCounts[c], 0);
  }
  private recipeContainer(): ContainerColor[] {
    return COLOR_KEYS.filter((c) => this.boxCounts[c] > 0).map((color) => ({
      color,
      balls: this.boxCounts[color] * GLOBAL_CHARGE,
      caps: this.boxCounts[color],
    }));
  }
  private queuesMatchRecipe(): boolean {
    if (this.queues.length !== this.queueCount) return false;
    const cnt: Record<string, number> = {};
    for (const c of COLOR_KEYS) cnt[c] = 0;
    for (const q of this.queues) for (const c of q) cnt[c]++;
    return COLOR_KEYS.every((c) => cnt[c] === this.boxCounts[c]);
  }
  private seedQueues() {
    const pool: ColorKey[] = [];
    for (const c of COLOR_KEYS) for (let i = 0; i < this.boxCounts[c]; i++) pool.push(c);
    const k = Math.max(1, this.queueCount);
    const cols: ColorKey[][] = Array.from({ length: k }, () => []);
    pool.forEach((c, i) => cols[i % k].push(c));
    this.queues = cols;
    this.queuesSig = this.boxRecipeSig();
  }

  // ---- stage 0: recipe ------------------------------------------------------

  private showStage0() {
    this.teardownDynamic();
    this.stage = 0;
    this.titleEl.textContent = 'Editor · 1. Recipe';
    this.backEl.textContent = '← Menu';
    this.prepBody(false);

    const setup = el('div', 'ed-card');
    const r1 = el('div', 'ed-row');
    const nameInput = document.createElement('input');
    nameInput.className = 'mini-num';
    nameInput.style.width = '150px';
    nameInput.value = this.name;
    nameInput.addEventListener('input', () => (this.name = nameInput.value));
    r1.append(el('span', 'ed-label', 'Name'), nameInput);
    const r2 = el('div', 'ed-row');
    r2.append(
      el('span', 'ed-label', 'Deck slots'),
      numInput(this.deckSlots, 1, 8, (v) => (this.deckSlots = v)),
      el('span', 'ed-label', 'Queues'),
      numInput(this.queueCount, 1, 6, (v) => {
        this.queueCount = v;
        this.updateStage0Status();
      }),
    );
    setup.append(r1, r2);

    const counts = section('Boxes per colour', () => {
      const wrap = el('div', 'ed-card');
      for (const c of COLOR_KEYS) {
        const row = el('div', 'ed-row');
        const dot = document.createElement('div');
        dot.className = 'color-dot active';
        dot.style.background = COLOR_CSS[c];
        dot.style.cursor = 'default';
        row.append(
          dot,
          el('span', 'ed-label', c),
          el('span', 'ed-spacer'),
          numInput(this.boxCounts[c], 0, 20, (v) => {
            this.boxCounts[c] = v;
            this.updateStage0Status();
          }),
        );
        wrap.append(row);
      }
      return wrap;
    });

    this.bodyEl.append(section('Setup', () => setup), counts, this.containerPreview());

    const next = btn('Next: Arrange queues →', 'btn small', () => this.goStage1());
    next.style.flex = '1';
    this.bottomEl.append(next);
    this.updateStage0Status();
  }

  private containerPreview(): HTMLElement {
    return section('Container (auto — derived)', () => {
      const wrap = el('div', 'ed-card');
      const container = this.recipeContainer();
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

  private updateStage0Status() {
    const total = this.totalBoxes();
    this.statusEl.classList.remove('ok', 'bad');
    if (total === 0) {
      this.statusEl.classList.add('bad');
      this.statusEl.textContent = 'Add at least one box (set a colour count above).';
    } else {
      this.statusEl.classList.add('ok');
      this.statusEl.textContent = `${total} boxes · ${this.queueCount} queues · charge ${GLOBAL_CHARGE}`;
    }
  }

  // ---- stage 1: distribute --------------------------------------------------

  private goStage1() {
    if (this.totalBoxes() === 0) {
      this.statusEl.classList.add('bad');
      this.statusEl.textContent = 'Add at least one box first.';
      return;
    }
    const reuse = this.queues.length > 0 && this.queuesSig === this.boxRecipeSig() && this.queuesMatchRecipe();
    if (!reuse) this.seedQueues();
    this.showStage1();
  }

  private showStage1() {
    this.teardownDynamic();
    this.stage = 1;
    this.titleEl.textContent = 'Editor · 2. Queues';
    this.backEl.textContent = '← Recipe';
    this.prepBody(true);
    this.statusEl.classList.remove('bad');
    this.statusEl.classList.add('ok');
    this.statusEl.textContent = 'Drag boxes between queues / reorder · top of a column = front (sent first).';

    const bar = makeBar();
    bar.append(btn('⤮ Shuffle queues', 'btn ghost small', () => this.board?.shuffle()));
    this.bodyEl.append(bar);

    this.board = new QueueBoard(this.bodyEl, this.queues);

    const next = btn('Next: Arrange container →', 'btn small', () => this.goStage2());
    next.style.flex = '1';
    this.bottomEl.append(next);
  }

  // ---- stage 2: container grid ----------------------------------------------

  private goStage2() {
    if (this.board) {
      this.queues = this.board.getQueues();
      this.queuesSig = this.boxRecipeSig();
    }
    const container = containerFromQueues(this.queuesDef(), GLOBAL_CHARGE);
    const reuse = this.layout && this.distSig() === this.layoutSig && layoutMatches(this.layout, container);
    if (!reuse) {
      this.layout = defaultClusteredLayout(container);
      this.layoutSig = this.distSig();
    }
    this.showStage2(container);
  }

  private showStage2(container = containerFromQueues(this.queuesDef(), GLOBAL_CHARGE)) {
    this.teardownDynamic();
    this.stage = 2;
    this.titleEl.textContent = 'Editor · 3. Container';
    this.backEl.textContent = '← Queues';
    this.prepBody(true);
    this.statusEl.classList.remove('bad');
    this.statusEl.classList.add('ok');
    this.statusEl.textContent =
      'Drag empty space to marquee-select balls · drag a selection or a cap to move · drops auto-arrange.';

    const { balls, caps } = totalCounts(container);
    const rows = gridRows(balls, caps);

    const bar = makeBar();
    bar.append(el('span', 'ed-label', 'Clustering'));
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.value = String(this.clustering);
    slider.style.flex = '1';
    const val = el('span', 'ed-label', this.clustering.toFixed(2));
    val.style.minWidth = '34px';
    slider.addEventListener('input', () => {
      this.clustering = parseFloat(slider.value);
      val.textContent = this.clustering.toFixed(2);
      this.reshuffleContainer(container);
    });
    bar.append(slider, val, btn('⤮ Shuffle', 'btn ghost small', () => this.reshuffleContainer(container)));
    this.bodyEl.append(bar);

    this.grid = new ContainerGrid(this.bodyEl, this.layout ?? defaultClusteredLayout(container), GRID_COLS, rows);

    const test = btn('▶ Test', 'btn small', () => this.cb.onTestPlay(this.snapshot()));
    const copy = btn('Copy JSON', 'btn ghost small', () => this.showJson());
    const dl = btn('↓ Download', 'btn ghost small', () => this.downloadJson());
    const save = btn('Save', 'btn small', () => this.save());
    this.bottomEl.append(test, copy, dl, save);
  }

  private reshuffleContainer(container: ContainerColor[]) {
    this.layout = shuffledLayout(container, this.clustering);
    this.layoutSig = this.distSig();
    this.grid?.setLayout(this.layout);
  }

  // ---- snapshot / persistence ----------------------------------------------

  private queuesDef() {
    return this.queues.map((q) => ({ boxes: q.map((color) => ({ color, charge: GLOBAL_CHARGE })) }));
  }

  private snapshot(): LevelData {
    this.teardownDynamic(); // pull latest from whichever component is open
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
    const snap = this.snapshot();
    saveCustomLevel(snap);
    this.showStage2(snap.container); // teardown disposed the grid; rebuild it
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
    this.showStage2(lv.container);
    this.flash('Downloaded — drop into src/levels/contributed/ to ship it.');
  }

  private showJson() {
    if (this.modalEl) return;
    const snap = this.snapshot();
    this.showStage2(snap.container);
    const modal = el('div', 'modal');
    const card = el('div', 'modal-card');
    card.innerHTML = '<h2>Level JSON</h2><p>Copy and save as a .json file.</p>';
    const ta = document.createElement('textarea');
    ta.className = 'json';
    ta.value = JSON.stringify(snap, null, 2);
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
    this.board?.dispose();
    this.board = null;
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

function makeBar(): HTMLDivElement {
  const bar = document.createElement('div');
  bar.style.display = 'flex';
  bar.style.alignItems = 'center';
  bar.style.gap = '8px';
  bar.style.flex = '0 0 auto';
  bar.style.padding = '2px 2px 8px';
  return bar;
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
