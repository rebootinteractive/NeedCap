import type { LevelData, ColorKey } from '../shared/types';
import { COLOR_KEYS, COLOR_CSS } from '../shared/colors';
import { saveCustomLevel } from '../ui/storage';

export interface EditorCallbacks {
  initial?: LevelData;
  onExit: () => void;
  onTestPlay: (lv: LevelData) => void;
}

interface ContainerRow {
  color: ColorKey;
  balls: number;
  caps: number;
}

export class EditorApp {
  private root: HTMLDivElement;
  private id: string;
  private name: string;
  private deckSlots: number;
  private queues: { color: ColorKey; charge: number }[][];
  private container: ContainerRow[];

  private newColor: ColorKey = 'red';
  private newCharge = 3;

  private bodyEl!: HTMLDivElement;
  private statusEl!: HTMLDivElement;
  private modalEl: HTMLDivElement | null = null;

  constructor(private parent: HTMLElement, private cb: EditorCallbacks) {
    const init = cb.initial;
    this.id = init?.id?.startsWith('custom-') ? init.id : `custom-${Date.now()}`;
    this.name = init?.name ?? 'New Level';
    this.deckSlots = init?.deckSlots ?? 4;
    this.queues = (init?.queues ?? [{ boxes: [] }]).map((q) =>
      q.boxes.map((b) => ({ color: b.color, charge: b.charge })),
    );
    if (this.queues.length === 0) this.queues = [[]];
    this.container = COLOR_KEYS.map((color) => {
      const found = init?.container.find((c) => c.color === color);
      return { color, balls: found?.balls ?? 0, caps: found?.caps ?? 0 };
    });

    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.style.background = 'linear-gradient(160deg, #1c1f2a 0%, #131520 100%)';
    parent.appendChild(this.root);
    this.buildShell();
    this.renderBody();
    this.updateStatus();
  }

  // ---- shell ----------------------------------------------------------------

  private buildShell() {
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Level Editor';
    const back = document.createElement('button');
    back.className = 'tool-btn';
    back.textContent = '← Menu';
    back.addEventListener('click', () => this.cb.onExit());
    toolbar.append(title, back);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'editor-status';

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'editor-body';

    const bottom = document.createElement('div');
    bottom.className = 'editor-bottom';
    const nameField = document.createElement('label');
    nameField.className = 'editor-field';
    nameField.innerHTML = '<span>Name</span>';
    const nameInput = document.createElement('input');
    nameInput.className = 'wide';
    nameInput.value = this.name;
    nameInput.addEventListener('input', () => {
      this.name = nameInput.value;
    });
    nameField.appendChild(nameInput);

    const test = btn('▶ Test', 'btn small', () => this.cb.onTestPlay(this.snapshot()));
    const copy = btn('Copy JSON', 'btn ghost small', () => this.showJson());
    const dl = btn('↓ Download', 'btn ghost small', () => this.downloadJson());
    const save = btn('Save', 'btn small', () => this.save());
    bottom.append(nameField, test, copy, dl, save);

    this.root.append(toolbar, this.statusEl, this.bodyEl, bottom);
  }

  // ---- body -----------------------------------------------------------------

  private renderBody() {
    this.bodyEl.innerHTML = '';

    // Deck section
    this.bodyEl.appendChild(
      section('Deck', () => {
        const card = document.createElement('div');
        card.className = 'ed-card';
        const row = document.createElement('div');
        row.className = 'ed-row';
        const label = document.createElement('span');
        label.className = 'ed-label';
        label.textContent = 'Slots';
        const inp = numInput(this.deckSlots, 1, 8, (v) => {
          this.deckSlots = v;
          this.updateStatus();
        });
        row.append(label, inp);
        card.appendChild(row);
        return card;
      }),
    );

    // New-box picker (shared)
    const picker = document.createElement('div');
    picker.className = 'ed-card';
    const prow = document.createElement('div');
    prow.className = 'ed-row';
    const plabel = document.createElement('span');
    plabel.className = 'ed-label';
    plabel.textContent = 'New box';
    const colorRow = document.createElement('div');
    colorRow.className = 'color-row';
    for (const c of COLOR_KEYS) {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (c === this.newColor ? ' active' : '');
      dot.style.background = COLOR_CSS[c];
      dot.addEventListener('click', () => {
        this.newColor = c;
        colorRow.querySelectorAll('.color-dot').forEach((d, i) =>
          d.classList.toggle('active', COLOR_KEYS[i] === c),
        );
      });
      colorRow.appendChild(dot);
    }
    const chargeLabel = document.createElement('span');
    chargeLabel.className = 'ed-label';
    chargeLabel.textContent = 'charge';
    const chargeInp = numInput(this.newCharge, 1, 12, (v) => {
      this.newCharge = v;
    });
    chargeInp.style.maxWidth = '56px';
    prow.append(plabel, colorRow, chargeLabel, chargeInp);
    picker.appendChild(prow);

    // Queues section
    const queuesSection = section('Queues (front box = leftmost)', () => {
      const wrap = document.createElement('div');
      wrap.appendChild(picker);
      this.queues.forEach((q, qi) => wrap.appendChild(this.queueCard(q, qi)));
      const addQ = btn('+ Add Queue', 'tool-btn', () => {
        this.queues.push([]);
        this.renderBody();
        this.updateStatus();
      });
      addQ.style.marginTop = '4px';
      wrap.appendChild(addQ);
      return wrap;
    });
    this.bodyEl.appendChild(queuesSection);

    // Container section
    this.bodyEl.appendChild(
      section('Container (loose balls + caps in the jar)', () => {
        const wrap = document.createElement('div');
        for (const row of this.container) wrap.appendChild(this.containerCard(row));
        return wrap;
      }),
    );
  }

  private queueCard(q: { color: ColorKey; charge: number }[], qi: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'ed-card';
    const row = document.createElement('div');
    row.className = 'ed-row';

    const label = document.createElement('span');
    label.className = 'ed-label';
    label.textContent = `Q${qi + 1}`;

    const chips = document.createElement('div');
    chips.className = 'queue-chips';
    q.forEach((b, bi) => {
      const chip = document.createElement('div');
      chip.className = 'chip removable';
      chip.style.background = COLOR_CSS[b.color];
      chip.textContent = String(b.charge);
      chip.title = `${b.color} · charge ${b.charge} (click to remove)`;
      chip.addEventListener('click', () => {
        q.splice(bi, 1);
        this.renderBody();
        this.updateStatus();
      });
      chips.appendChild(chip);
    });
    if (q.length === 0) {
      const empty = document.createElement('span');
      empty.style.color = 'var(--muted)';
      empty.style.fontSize = '12px';
      empty.textContent = 'empty';
      chips.appendChild(empty);
    }

    const addBox = btn('+ box', 'tool-btn', () => {
      q.push({ color: this.newColor, charge: this.newCharge });
      this.renderBody();
      this.updateStatus();
    });
    const delQ = btn('✕', 'tool-btn', () => {
      this.queues.splice(qi, 1);
      if (this.queues.length === 0) this.queues = [[]];
      this.renderBody();
      this.updateStatus();
    });

    row.append(label, chips, addBox, delQ);
    card.appendChild(row);
    return card;
  }

  private containerCard(row: ContainerRow): HTMLElement {
    const card = document.createElement('div');
    card.className = 'ed-card';
    const r = document.createElement('div');
    r.className = 'ed-row';

    const dot = document.createElement('div');
    dot.className = 'color-dot active';
    dot.style.background = COLOR_CSS[row.color];
    dot.style.cursor = 'default';

    const ballLbl = document.createElement('span');
    ballLbl.className = 'ed-label';
    ballLbl.textContent = 'balls';
    const ballInp = numInput(row.balls, 0, 60, (v) => {
      row.balls = v;
      this.updateStatus();
    });
    const capLbl = document.createElement('span');
    capLbl.className = 'ed-label';
    capLbl.textContent = 'caps';
    const capInp = numInput(row.caps, 0, 20, (v) => {
      row.caps = v;
      this.updateStatus();
    });

    r.append(dot, ballLbl, ballInp, capLbl, capInp);
    card.appendChild(r);
    return card;
  }

  // ---- validation -----------------------------------------------------------

  private updateStatus() {
    const demandBalls: Record<string, number> = {};
    const demandCaps: Record<string, number> = {};
    for (const c of COLOR_KEYS) {
      demandBalls[c] = 0;
      demandCaps[c] = 0;
    }
    let totalBoxes = 0;
    for (const q of this.queues)
      for (const b of q) {
        demandBalls[b.color] += b.charge;
        demandCaps[b.color] += 1;
        totalBoxes++;
      }
    const issues: string[] = [];
    for (const row of this.container) {
      if (row.balls < demandBalls[row.color])
        issues.push(`${row.color}: needs ≥${demandBalls[row.color]} balls (has ${row.balls})`);
      if (row.caps < demandCaps[row.color])
        issues.push(`${row.color}: needs ≥${demandCaps[row.color]} caps (has ${row.caps})`);
    }

    this.statusEl.classList.remove('ok', 'bad');
    if (totalBoxes === 0) {
      this.statusEl.classList.add('bad');
      this.statusEl.textContent = 'Add at least one box to a queue.';
    } else if (issues.length > 0) {
      this.statusEl.classList.add('bad');
      this.statusEl.textContent = `Not solvable — ${issues[0]}`;
    } else {
      this.statusEl.classList.add('ok');
      this.statusEl.textContent = `Solvable ✓ · ${totalBoxes} boxes across ${this.queues.length} queues`;
    }
  }

  // ---- snapshot / persistence ----------------------------------------------

  private snapshot(): LevelData {
    return {
      id: this.id,
      name: this.name.trim() || 'Untitled',
      deckSlots: this.deckSlots,
      queues: this.queues.map((q) => ({ boxes: q.map((b) => ({ color: b.color, charge: b.charge })) })),
      container: this.container
        .filter((c) => c.balls > 0 || c.caps > 0)
        .map((c) => ({ color: c.color, balls: c.balls, caps: c.caps })),
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
      (lv.name || lv.id || 'level')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'level';
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
    const modal = document.createElement('div');
    modal.className = 'modal';
    const card = document.createElement('div');
    card.className = 'modal-card';
    card.innerHTML = '<h2>Level JSON</h2><p>Copy and save as a .json file.</p>';
    const ta = document.createElement('textarea');
    ta.className = 'json';
    ta.value = JSON.stringify(this.snapshot(), null, 2);
    ta.readOnly = true;
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
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
    this.statusEl.textContent = msg;
    window.setTimeout(() => this.updateStatus(), 2200);
  }

  dispose() {
    this.modalEl?.remove();
    this.modalEl = null;
    this.root.remove();
  }
}

// ---- small DOM helpers ------------------------------------------------------

function btn(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function numInput(
  value: number,
  min: number,
  max: number,
  onChange: (v: number) => void,
): HTMLInputElement {
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
  const s = document.createElement('div');
  s.className = 'ed-section';
  const h = document.createElement('h3');
  h.textContent = title;
  s.appendChild(h);
  s.appendChild(build());
  return s;
}
