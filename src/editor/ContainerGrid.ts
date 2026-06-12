import type { ColorKey, PlacedPiece } from '../shared/types';
import { COLOR_CSS } from '../shared/colors';

interface GP {
  id: number;
  type: 'ball' | 'cap';
  color: ColorKey;
  col: number;
  row: number; // bottom-left anchor; row 0 = bottom
}

type DragMode = 'none' | 'marquee' | 'move';

/**
 * Canvas grid editor for arranging the container's balls + caps.
 * - drag on empty space → marquee-select balls
 * - drag a selected ball → move the whole selection
 * - drag an unselected ball → select+move just it
 * - drag a cap → move the cap (2×2)
 * Drops auto-displace any bumped pieces to the nearest free cells.
 */
export class ContainerGrid {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver;

  private cols: number;
  private rows: number;
  private pieces: GP[] = [];
  private selection = new Set<number>();

  private cellPx = 24;
  private offX = 0;
  private offY = 0;

  // drag bookkeeping
  private mode: DragMode = 'none';
  private startPx = { x: 0, y: 0 };
  private curPx = { x: 0, y: 0 };
  private dragIds = new Set<number>();
  private previewDelta = { dc: 0, dr: 0 };

  constructor(parent: HTMLElement, layout: PlacedPiece[], cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    let id = 1;
    this.pieces = layout.map((p) => ({ id: id++, type: p.type, color: p.color, col: p.col, row: p.row }));

    this.el = document.createElement('div');
    this.el.style.position = 'relative';
    this.el.style.flex = '1';
    this.el.style.minHeight = '0';
    parent.appendChild(this.el);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.touchAction = 'none';
    this.canvas.style.display = 'block';
    this.el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);

    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this.el);
    this.fit();
  }

  getLayout(): PlacedPiece[] {
    return this.pieces.map((p) => ({ type: p.type, color: p.color, col: p.col, row: p.row }));
  }

  // ---- layout / sizing ------------------------------------------------------

  private fit() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = this.el.clientWidth || 1;
    const h = this.el.clientHeight || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cellPx = Math.max(8, Math.floor(Math.min(w / this.cols, h / this.rows)));
    const gridW = this.cellPx * this.cols;
    const gridH = this.cellPx * this.rows;
    this.offX = Math.floor((w - gridW) / 2);
    this.offY = Math.floor((h - gridH) / 2);
    this.draw();
  }

  // ---- coordinate helpers ---------------------------------------------------

  private toLocal(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private pxToCell(px: number, py: number): { col: number; row: number } {
    const col = Math.floor((px - this.offX) / this.cellPx);
    const rowTop = Math.floor((py - this.offY) / this.cellPx);
    const row = this.rows - 1 - rowTop;
    return { col, row };
  }
  private cellOriginPx(col: number, row: number): { x: number; y: number } {
    const rowTop = this.rows - 1 - row;
    return { x: this.offX + col * this.cellPx, y: this.offY + rowTop * this.cellPx };
  }

  private cellsOf(p: GP, dc = 0, dr = 0): [number, number][] {
    const c = p.col + dc;
    const r = p.row + dr;
    if (p.type === 'ball') return [[c, r]];
    return [
      [c, r],
      [c + 1, r],
      [c, r + 1],
      [c + 1, r + 1],
    ];
  }

  private pieceAtCell(col: number, row: number): GP | null {
    for (const p of this.pieces) {
      for (const [c, r] of this.cellsOf(p)) if (c === col && r === row) return p;
    }
    return null;
  }

  // ---- pointer interaction --------------------------------------------------

  private onDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture?.(e.pointerId);
    const lp = this.toLocal(e);
    this.startPx = lp;
    this.curPx = lp;
    this.previewDelta = { dc: 0, dr: 0 };
    const { col, row } = this.pxToCell(lp.x, lp.y);
    const hit = this.pieceAtCell(col, row);

    if (hit && hit.type === 'cap') {
      this.mode = 'move';
      this.selection.clear();
      this.dragIds = new Set([hit.id]);
    } else if (hit && hit.type === 'ball') {
      this.mode = 'move';
      if (!this.selection.has(hit.id)) this.selection = new Set([hit.id]);
      this.dragIds = new Set(this.selection);
    } else {
      this.mode = 'marquee';
      this.dragIds.clear();
    }
    this.draw();
  };

  private onMove = (e: PointerEvent) => {
    if (this.mode === 'none') return;
    this.curPx = this.toLocal(e);
    if (this.mode === 'move') {
      const dc = Math.round((this.curPx.x - this.startPx.x) / this.cellPx);
      const dr = -Math.round((this.curPx.y - this.startPx.y) / this.cellPx);
      this.previewDelta = this.clampDelta(this.dragIds, dc, dr);
    }
    this.draw();
  };

  private onUp = (_e: PointerEvent) => {
    if (this.mode === 'marquee') {
      this.applyMarquee();
    } else if (this.mode === 'move') {
      const { dc, dr } = this.previewDelta;
      if (dc !== 0 || dr !== 0) this.moveSet(this.dragIds, dc, dr);
    }
    this.mode = 'none';
    this.dragIds.clear();
    this.previewDelta = { dc: 0, dr: 0 };
    this.draw();
  };

  private applyMarquee() {
    const x0 = Math.min(this.startPx.x, this.curPx.x);
    const x1 = Math.max(this.startPx.x, this.curPx.x);
    const y0 = Math.min(this.startPx.y, this.curPx.y);
    const y1 = Math.max(this.startPx.y, this.curPx.y);
    // a click (tiny rect) clears selection
    if (x1 - x0 < 6 && y1 - y0 < 6) {
      this.selection.clear();
      return;
    }
    const sel = new Set<number>();
    for (const p of this.pieces) {
      if (p.type !== 'ball') continue;
      const o = this.cellOriginPx(p.col, p.row);
      const cx = o.x + this.cellPx / 2;
      const cy = o.y + this.cellPx / 2;
      if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) sel.add(p.id);
    }
    this.selection = sel;
  }

  // ---- move + auto-displace -------------------------------------------------

  private clampDelta(ids: Set<number>, dc: number, dr: number): { dc: number; dr: number } {
    let minDc = -Infinity;
    let maxDc = Infinity;
    let minDr = -Infinity;
    let maxDr = Infinity;
    for (const p of this.pieces) {
      if (!ids.has(p.id)) continue;
      const maxColAnchor = p.type === 'cap' ? this.cols - 2 : this.cols - 1;
      const maxRowAnchor = p.type === 'cap' ? this.rows - 2 : this.rows - 1;
      minDc = Math.max(minDc, -p.col);
      maxDc = Math.min(maxDc, maxColAnchor - p.col);
      minDr = Math.max(minDr, -p.row);
      maxDr = Math.min(maxDr, maxRowAnchor - p.row);
    }
    return {
      dc: Math.max(minDc, Math.min(maxDc, dc)),
      dr: Math.max(minDr, Math.min(maxDr, dr)),
    };
  }

  private blankOcc(): Int32Array {
    return new Int32Array(this.cols * this.rows).fill(-1);
  }
  private idx(c: number, r: number) {
    return r * this.cols + c;
  }
  private inBounds(p: GP, c: number, r: number): boolean {
    if (c < 0 || r < 0) return false;
    if (p.type === 'cap') return c <= this.cols - 2 && r <= this.rows - 2;
    return c <= this.cols - 1 && r <= this.rows - 1;
  }

  private moveSet(ids: Set<number>, dc: number, dr: number) {
    const moving = this.pieces.filter((p) => ids.has(p.id));
    const stationary = this.pieces.filter((p) => !ids.has(p.id));

    const occ = this.blankOcc();
    for (const s of stationary) for (const [c, r] of this.cellsOf(s)) occ[this.idx(c, r)] = s.id;

    // cells the moving pieces will land on
    const movingCells = new Set<number>();
    for (const m of moving) for (const [c, r] of this.cellsOf(m, dc, dr)) movingCells.add(this.idx(c, r));

    // bumped = stationary intersecting those cells
    const bumpedIds = new Set<number>();
    for (const s of stationary)
      for (const [c, r] of this.cellsOf(s)) if (movingCells.has(this.idx(c, r))) bumpedIds.add(s.id);
    const bumped = stationary.filter((s) => bumpedIds.has(s.id));
    for (const b of bumped) for (const [c, r] of this.cellsOf(b)) occ[this.idx(c, r)] = -1;

    // commit moving
    for (const m of moving) {
      m.col += dc;
      m.row += dr;
      for (const [c, r] of this.cellsOf(m)) occ[this.idx(c, r)] = m.id;
    }

    // re-place bumped: caps first, then balls
    bumped.sort((a, b) => (a.type === 'cap' ? 0 : 1) - (b.type === 'cap' ? 0 : 1));
    for (const b of bumped) {
      const spot = this.nearestFree(b, occ);
      if (spot) {
        b.col = spot[0];
        b.row = spot[1];
      }
      for (const [c, r] of this.cellsOf(b)) {
        if (c >= 0 && r >= 0 && c < this.cols && r < this.rows) occ[this.idx(c, r)] = b.id;
      }
    }
  }

  private fits(p: GP, c: number, r: number, occ: Int32Array): boolean {
    if (!this.inBounds(p, c, r)) return false;
    const cells = p.type === 'cap' ? [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]] : [[c, r]];
    for (const [cc, rr] of cells) if (occ[this.idx(cc, rr)] !== -1) return false;
    return true;
  }

  private nearestFree(p: GP, occ: Int32Array): [number, number] | null {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    const maxC = p.type === 'cap' ? this.cols - 2 : this.cols - 1;
    const maxR = p.type === 'cap' ? this.rows - 2 : this.rows - 1;
    for (let r = 0; r <= maxR; r++) {
      for (let c = 0; c <= maxC; c++) {
        if (!this.fits(p, c, r, occ)) continue;
        const d = (c - p.col) * (c - p.col) + (r - p.row) * (r - p.row);
        if (d < bestD) {
          bestD = d;
          best = [c, r];
        }
      }
    }
    return best;
  }

  // ---- rendering ------------------------------------------------------------

  private draw() {
    const ctx = this.ctx;
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // grid cells
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const o = this.cellOriginPx(c, r);
        ctx.strokeRect(o.x + 0.5, o.y + 0.5, this.cellPx, this.cellPx);
      }
    }

    const dragging = this.mode === 'move';
    const { dc, dr } = this.previewDelta;

    // caps first (behind), then balls
    for (const p of [...this.pieces].sort((a, b) => (a.type === 'cap' ? -1 : 0) - (b.type === 'cap' ? -1 : 0))) {
      const isDragged = dragging && this.dragIds.has(p.id);
      const oc = isDragged ? p.col + dc : p.col;
      const or = isDragged ? p.row + dr : p.row;
      const o = this.cellOriginPx(oc, or);
      ctx.globalAlpha = isDragged ? 0.7 : 1;
      if (p.type === 'cap') {
        const size = this.cellPx * 2;
        // cap origin is top of its 2-row span
        const top = this.cellOriginPx(oc, or + 1);
        roundRect(ctx, top.x + 3, top.y + 3, size - 6, size - 6, 8);
        ctx.fillStyle = COLOR_CSS[p.color];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.stroke();
      } else {
        const cx = o.x + this.cellPx / 2;
        const cy = o.y + this.cellPx / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, this.cellPx * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = COLOR_CSS[p.color];
        ctx.fill();
        if (this.selection.has(p.id)) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // marquee
    if (this.mode === 'marquee') {
      const x0 = Math.min(this.startPx.x, this.curPx.x);
      const y0 = Math.min(this.startPx.y, this.curPx.y);
      const mw = Math.abs(this.curPx.x - this.startPx.x);
      const mh = Math.abs(this.curPx.y - this.startPx.y);
      ctx.fillStyle = 'rgba(88,225,196,0.15)';
      ctx.strokeStyle = '#58e1c4';
      ctx.lineWidth = 1.5;
      ctx.fillRect(x0, y0, mw, mh);
      ctx.strokeRect(x0, y0, mw, mh);
    }
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.ro.disconnect();
    this.el.remove();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
