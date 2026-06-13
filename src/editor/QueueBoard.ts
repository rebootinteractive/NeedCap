import type { ColorKey } from '../shared/types';
import { COLOR_CSS } from '../shared/colors';

interface Tile {
  id: number;
  color: ColorKey;
}

/**
 * Canvas board for distributing boxes across queues. Each column is a queue;
 * the TOP tile is the front box (sent first). Drag a box to another column or to
 * a new position to move/reorder it.
 */
export class QueueBoard {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver;

  private cols: Tile[][];
  private headerH = 24;
  private gap = 8;
  private padTop = 8;
  private tile = 48;
  private colW = 60;

  // drag state
  private dragging = false;
  private dragTile: Tile | null = null;
  private dragFrom = -1;
  private curPx = { x: 0, y: 0 };
  private moved = false;

  constructor(parent: HTMLElement, queues: ColorKey[][]) {
    let id = 1;
    this.cols = queues.map((q) => q.map((color) => ({ id: id++, color })));

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

  getQueues(): ColorKey[][] {
    return this.cols.map((c) => c.map((t) => t.color));
  }

  /** Re-deal all boxes randomly across the same number of queues. */
  shuffle() {
    const tiles: Tile[] = this.cols.flat();
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const k = this.cols.length;
    const cols: Tile[][] = Array.from({ length: k }, () => []);
    tiles.forEach((t, i) => cols[i % k].push(t));
    this.cols = cols;
    this.fit();
  }

  // ---- sizing ---------------------------------------------------------------

  private fit() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = this.el.clientWidth || 1;
    const h = this.el.clientHeight || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const k = Math.max(1, this.cols.length);
    this.colW = (w - this.gap * (k + 1)) / k;
    const maxStack = Math.max(1, ...this.cols.map((c) => c.length));
    const availH = h - this.headerH - this.padTop - 4;
    this.tile = Math.max(
      16,
      Math.min(this.colW - 8, 56, Math.floor(availH / maxStack) - 4),
    );
    this.draw();
  }

  private colX(i: number): number {
    return this.gap + i * (this.colW + this.gap);
  }
  private tileTop(t: number): number {
    return this.headerH + this.padTop + t * (this.tile + 4);
  }

  // ---- hit testing ----------------------------------------------------------

  private toLocal(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private colAt(px: number): number {
    for (let i = 0; i < this.cols.length; i++) {
      const x = this.colX(i);
      if (px >= x && px <= x + this.colW) return i;
    }
    // clamp to nearest
    if (px < this.colX(0)) return 0;
    return this.cols.length - 1;
  }
  private tileAt(col: number, py: number): number {
    const t = Math.floor((py - (this.headerH + this.padTop)) / (this.tile + 4));
    if (t < 0 || t >= this.cols[col].length) return -1;
    return t;
  }

  // ---- pointer --------------------------------------------------------------

  private onDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture?.(e.pointerId);
    const lp = this.toLocal(e);
    this.curPx = lp;
    this.moved = false;
    const col = this.colAt(lp.x);
    const idx = this.tileAt(col, lp.y);
    if (idx >= 0) {
      this.dragging = true;
      this.dragFrom = col;
      this.dragTile = this.cols[col][idx];
    }
    this.draw();
  };

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const lp = this.toLocal(e);
    if (Math.hypot(lp.x - this.curPx.x, lp.y - this.curPx.y) > 2) this.moved = true;
    this.curPx = lp;
    this.draw();
  };

  private onUp = (_e: PointerEvent) => {
    if (this.dragging && this.dragTile && this.moved) {
      const tile = this.dragTile;
      // remove from source
      const src = this.cols[this.dragFrom];
      const si = src.indexOf(tile);
      if (si >= 0) src.splice(si, 1);
      // target column + insertion index
      const tcol = this.colAt(this.curPx.x);
      const list = this.cols[tcol];
      let ins = Math.round((this.curPx.y - (this.headerH + this.padTop)) / (this.tile + 4));
      ins = Math.max(0, Math.min(list.length, ins));
      list.splice(ins, 0, tile);
    }
    this.dragging = false;
    this.dragTile = null;
    this.dragFrom = -1;
    this.moved = false;
    this.draw();
  };

  // ---- rendering ------------------------------------------------------------

  private drawTile(x: number, y: number, color: ColorKey, alpha = 1, front = false) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    roundRect(ctx, x, y, this.tile, this.tile, 8);
    ctx.fillStyle = COLOR_CSS[color];
    ctx.fill();
    ctx.lineWidth = front ? 3 : 1.5;
    ctx.strokeStyle = front ? '#ffffff' : 'rgba(0,0,0,0.35)';
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = `bold ${Math.round(this.tile * 0.38)}px -apple-system, Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('10', x + this.tile / 2, y + this.tile / 2);
    ctx.globalAlpha = 1;
  }

  private draw() {
    const ctx = this.ctx;
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < this.cols.length; i++) {
      const x = this.colX(i);
      // column panel
      roundRect(ctx, x, this.headerH, this.colW, h - this.headerH - 2, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      // header
      ctx.fillStyle = '#8b91a6';
      ctx.font = 'bold 12px -apple-system, Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Q${i + 1} ▲`, x + this.colW / 2, this.headerH / 2);

      const list = this.cols[i];
      for (let t = 0; t < list.length; t++) {
        const tile = list[t];
        if (this.dragging && tile === this.dragTile) continue; // drawn as ghost
        const tx = x + (this.colW - this.tile) / 2;
        this.drawTile(tx, this.tileTop(t), tile.color, 1, t === 0);
      }
    }

    // insertion indicator + ghost
    if (this.dragging && this.dragTile) {
      const tcol = this.colAt(this.curPx.x);
      const list = this.cols[tcol].filter((t) => t !== this.dragTile);
      let ins = Math.round((this.curPx.y - (this.headerH + this.padTop)) / (this.tile + 4));
      ins = Math.max(0, Math.min(list.length, ins));
      const lineY = this.tileTop(ins) - 2;
      ctx.strokeStyle = '#58e1c4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.colX(tcol) + 6, lineY);
      ctx.lineTo(this.colX(tcol) + this.colW - 6, lineY);
      ctx.stroke();
      // ghost follows cursor
      this.drawTile(this.curPx.x - this.tile / 2, this.curPx.y - this.tile / 2, this.dragTile.color, 0.8);
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
