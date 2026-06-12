import type { ColorKey, ContainerColor, PlacedPiece, QueueDef } from './types';
import { COLOR_KEYS } from './colors';

/** Width of the container grid in ball-cells. Caps span a 2×2 block. */
export const GRID_COLS = 10;

/** Rows needed to hold the given pieces, with a little headroom for shuffling. */
export function gridRows(balls: number, caps: number): number {
  const cells = balls + caps * 4;
  return Math.max(7, Math.ceil(cells / GRID_COLS) + 3);
}

export function totalCounts(container: ContainerColor[]): { balls: number; caps: number } {
  let balls = 0;
  let caps = 0;
  for (const c of container) {
    balls += c.balls;
    caps += c.caps;
  }
  return { balls, caps };
}

/** Zero-sum container derived from the queues: each box needs `charge` balls + 1 cap. */
export function containerFromQueues(queues: QueueDef[], charge: number): ContainerColor[] {
  const balls: Record<string, number> = {};
  const caps: Record<string, number> = {};
  for (const c of COLOR_KEYS) {
    balls[c] = 0;
    caps[c] = 0;
  }
  for (const q of queues)
    for (const b of q.boxes) {
      balls[b.color] += charge;
      caps[b.color] += 1;
    }
  return COLOR_KEYS.filter((c) => balls[c] > 0 || caps[c] > 0).map((color) => ({
    color,
    balls: balls[color],
    caps: caps[color],
  }));
}

/**
 * A tidy starting arrangement: fill the grid bottom-up, colour by colour, caps
 * before that colour's balls — so each colour ends up clustered together.
 */
export function defaultClusteredLayout(container: ContainerColor[]): PlacedPiece[] {
  const { balls, caps } = totalCounts(container);
  const rows = gridRows(balls, caps);
  const occ: boolean[][] = Array.from({ length: rows }, () => new Array(GRID_COLS).fill(false));
  const out: PlacedPiece[] = [];

  const findBall = (): [number, number] | null => {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < GRID_COLS; c++) if (!occ[r][c]) return [c, r];
    return null;
  };
  const findCap = (): [number, number] | null => {
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < GRID_COLS - 1; c++)
        if (!occ[r][c] && !occ[r][c + 1] && !occ[r + 1][c] && !occ[r + 1][c + 1]) return [c, r];
    return null;
  };

  // order colours by COLOR_KEYS for stable clustering
  const ordered = COLOR_KEYS.map((color) => container.find((c) => c.color === color)).filter(
    (c): c is ContainerColor => !!c,
  );

  for (const c of ordered) {
    for (let i = 0; i < c.caps; i++) {
      const spot = findCap() ?? findBall();
      if (!spot) continue;
      const [col, row] = spot;
      occ[row][col] = true;
      if (row + 1 < rows && col + 1 < GRID_COLS) {
        occ[row][col + 1] = true;
        occ[row + 1][col] = true;
        occ[row + 1][col + 1] = true;
      }
      out.push({ type: 'cap', color: c.color, col, row });
    }
    for (let i = 0; i < c.balls; i++) {
      const spot = findBall();
      if (!spot) continue;
      const [col, row] = spot;
      occ[row][col] = true;
      out.push({ type: 'ball', color: c.color, col, row });
    }
  }
  return out;
}

/** Does a layout's piece multiset match the container counts exactly? */
export function layoutMatches(layout: PlacedPiece[] | undefined, container: ContainerColor[]): boolean {
  if (!layout) return false;
  const want: Record<string, number> = {};
  for (const c of container) {
    want[`ball:${c.color}`] = c.balls;
    want[`cap:${c.color}`] = c.caps;
  }
  const have: Record<string, number> = {};
  for (const p of layout) have[`${p.type}:${p.color}`] = (have[`${p.type}:${p.color}`] ?? 0) + 1;
  const keys = new Set([...Object.keys(want), ...Object.keys(have)]);
  for (const k of keys) if ((want[k] ?? 0) !== (have[k] ?? 0)) return false;
  return true;
}
