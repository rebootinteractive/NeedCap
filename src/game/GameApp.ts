import * as THREE from 'three';
import type { LevelData, ColorKey, PlacedPiece } from '../shared/types';
import { COLOR_KEYS } from '../shared/colors';
import { defaultClusteredLayout, layoutMatches, GRID_COLS } from '../shared/containerLayout';
import { Physics } from './Physics';
import { Resources } from './Resources';
import { Scenery } from './Scenery';
import { Piece } from './Piece';
import { Box } from './Box';
import { Input } from './Input';
import { Hud } from './Hud';
import { Anim, CallbackAnim, MoveAnim, PopAnim, easeInOut } from './anim';
import {
  JAR,
  HALF_WIDTH,
  DECK_Y,
  BOX_SIZE,
  QUEUE_TOP_Y,
  QUEUE_GAP,
  BALL_RADIUS,
  CAP_SIZE,
  PULL_COOLDOWN,
  BALL_GLIDE,
  CAP_GLIDE,
  SEND_GLIDE,
  SHIFT_GLIDE,
  VIEW_CENTER_Y,
  VIEW_HALF_HEIGHT,
} from './config';

export interface GameCallbacks {
  level: LevelData;
  onMenu: () => void;
  onRestart: () => void;
  /** if set, the HUD "menu" button label returns to the editor */
  returnLabel?: string;
}

const STACK_STEP = BOX_SIZE + QUEUE_GAP;

export class GameApp {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private rafId = 0;
  private clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;

  private physics!: Physics;
  private resources = new Resources();
  private scenery!: Scenery;

  private pieces: Piece[] = [];
  private queues: Box[][] = [];
  private deck: (Box | null)[] = [];
  private deckX: number[] = [];
  private queueX: number[] = [];
  private anims: Anim[] = [];

  private input: Input;
  private hud: Hud;
  private ended = false;
  private light!: THREE.DirectionalLight;

  constructor(private parent: HTMLElement, private cb: GameCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x12151d);
    parent.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

    // Decide how tall the jar walls must be so nothing spawns above them and
    // escapes sideways. The top extends off-screen for big levels.
    const pieceLayout = this.computeLayout(cb.level);
    let maxRow = 0;
    for (const p of pieceLayout) maxRow = Math.max(maxRow, p.type === 'cap' ? p.row + 1 : p.row);
    const neededTop = cellToWorld(0, maxRow, 'ball').y + 2.0;
    const wallTop = Math.max(JAR.topY, neededTop);

    this.physics = new Physics(wallTop);
    this.scenery = new Scenery(wallTop);
    this.scene.add(this.scenery.group);
    this.setupLights();

    this.setupDeckQueues(cb.level);
    this.spawnFromLayout(pieceLayout);
    this.buildQueues(cb.level);

    this.input = new Input(this.renderer.domElement, this.camera, (p) => this.onTap(p));
    this.hud = new Hud(parent, cb.level.name, {
      menuLabel: cb.returnLabel ?? '☰ Menu',
      onRestart: () => cb.onRestart(),
      onMenu: () => cb.onMenu(),
    });
    this.refreshCounter();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(parent);
    this.handleResize();

    this.loop();
  }

  // ---- setup ----------------------------------------------------------------

  private setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xbfd3ff, 0x202434, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 1.05);
    dir.position.set(5, 20, 11);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 50;
    dir.shadow.camera.left = -6;
    dir.shadow.camera.right = 6;
    dir.shadow.camera.top = 17;
    dir.shadow.camera.bottom = -2;
    dir.shadow.bias = -0.0004;
    dir.target.position.set(0, 7.5, 0);
    this.scene.add(dir);
    this.scene.add(dir.target);
    this.light = dir;
  }

  private setupDeckQueues(level: LevelData) {
    const slots = Math.max(1, level.deckSlots);
    this.deck = new Array(slots).fill(null);
    this.deckX = spread(slots, HALF_WIDTH * 2 - BOX_SIZE - 0.2);
    this.queueX = spread(level.queues.length, HALF_WIDTH * 2 - BOX_SIZE - 0.5);
  }

  /** The designer's arranged layout, or a tidy clustered fallback. */
  private computeLayout(level: LevelData): PlacedPiece[] {
    return layoutMatches(level.layout, level.container) && level.layout
      ? level.layout
      : defaultClusteredLayout(level.container);
  }

  private spawnFromLayout(layout: PlacedPiece[]) {
    for (const p of layout) {
      const { x, y } = cellToWorld(p.col, p.row, p.type);
      const jx = x + rand(-0.03, 0.03);
      const jy = y + rand(-0.03, 0.03);
      const body =
        p.type === 'ball'
          ? this.physics.addCircle(jx, jy, BALL_RADIUS)
          : this.physics.addBox(jx, jy, CAP_SIZE);
      const piece = new Piece(p.type, p.color, body, this.resources);
      this.pieces.push(piece);
      this.scene.add(piece.mesh);
    }
  }

  private buildQueues(level: LevelData) {
    this.queues = level.queues.map((q, qi) => {
      const boxes = q.boxes.map((def, bi) => {
        const box = new Box(def, this.resources);
        box.setPosition(this.queueX[qi], QUEUE_TOP_Y - bi * STACK_STEP);
        this.scene.add(box.group);
        return box;
      });
      return boxes;
    });
  }

  // ---- input ----------------------------------------------------------------

  private onTap(p: THREE.Vector3) {
    if (this.ended) return;
    if (p.y > DECK_Y + 0.6) return; // tapped up in the jar — ignore
    // nearest queue column
    let qi = -1;
    let best = Infinity;
    for (let i = 0; i < this.queueX.length; i++) {
      const d = Math.abs(p.x - this.queueX[i]);
      if (d < best) {
        best = d;
        qi = i;
      }
    }
    if (qi < 0) return;
    const spacing = this.queueX.length > 1 ? Math.abs(this.queueX[1] - this.queueX[0]) : HALF_WIDTH * 2;
    if (best > spacing / 2 + 0.1) return;
    this.sendFromQueue(qi);
  }

  private sendFromQueue(qi: number) {
    const queue = this.queues[qi];
    if (!queue || queue.length === 0) return;
    const slot = this.deck.findIndex((b) => b === null);
    if (slot < 0) return; // deck full

    const box = queue.shift()!;
    box.state = 'flying';
    this.deck[slot] = box;
    const target = new THREE.Vector3(this.deckX[slot], DECK_Y, 0);
    this.anims.push(
      new MoveAnim(box.group, target, SEND_GLIDE, () => {
        box.state = 'deck';
        box.cooldown = 0.08;
      }, 0.6),
    );
    // shift the rest of this queue up
    queue.forEach((b, bi) => {
      const ty = QUEUE_TOP_Y - bi * STACK_STEP;
      this.anims.push(new MoveAnim(b.group, new THREE.Vector3(this.queueX[qi], ty, 0), SHIFT_GLIDE));
    });
    this.refreshCounter();
  }

  // ---- pull / seal loop -----------------------------------------------------

  private findGrabbable(type: 'ball' | 'cap', color: ColorKey): Piece | null {
    let best: Piece | null = null;
    let bestY = Infinity;
    for (const piece of this.pieces) {
      if (piece.claimed || piece.removed || piece.type !== type || piece.color !== color) continue;
      const y = piece.centerY();
      if (y > JAR.pullLineY) continue;
      if (y < bestY) {
        bestY = y;
        best = piece;
      }
    }
    return best;
  }

  private runPullLoop(dt: number) {
    for (let slot = 0; slot < this.deck.length; slot++) {
      const box = this.deck[slot];
      if (!box || box.state !== 'deck') continue;
      if (box.cooldown > 0) box.cooldown -= dt;
      if (box.pulling || box.cooldown > 0) continue;

      if (!box.isCharged) {
        const piece = this.findGrabbable('ball', box.color);
        if (piece) this.startBallPull(box, piece);
      } else if (!box.hasCap) {
        const piece = this.findGrabbable('cap', box.color);
        if (piece) this.startCapPull(box, slot, piece);
      }
    }
  }

  private startBallPull(box: Box, piece: Piece) {
    box.pulling = true;
    piece.claimed = true;
    piece.detachBody((b) => this.physics.remove(b));
    const target = box.group.position.clone().add(new THREE.Vector3(0, 0.05, 0.35));
    this.glidePiece(piece.mesh, target, BALL_GLIDE, 0.55, () => {
      this.scene.remove(piece.mesh);
      piece.removed = true;
      box.addBall();
      box.pulling = false;
      box.cooldown = PULL_COOLDOWN;
    });
  }

  private startCapPull(box: Box, slot: number, piece: Piece) {
    box.pulling = true;
    piece.claimed = true;
    piece.detachBody((b) => this.physics.remove(b));
    const target = box.group.position.clone().add(new THREE.Vector3(0, BOX_SIZE / 2 + 0.1, 0));
    this.glidePiece(piece.mesh, target, CAP_GLIDE, undefined, () => {
      this.scene.remove(piece.mesh);
      piece.removed = true;
      box.setCap();
      this.sealBox(box, slot);
    });
  }

  private sealBox(box: Box, slot: number) {
    box.state = 'capping';
    this.anims.push(
      new PopAnim(box.group, 0.3, () => {
        box.dispose();
        if (this.deck[slot] === box) this.deck[slot] = null;
        this.refreshCounter();
      }),
    );
  }

  /** Move a mesh to target over dur seconds, optionally scaling to `scaleTo`. */
  private glidePiece(
    mesh: THREE.Object3D,
    target: THREE.Vector3,
    dur: number,
    scaleTo: number | undefined,
    onDone: () => void,
  ) {
    const start = mesh.position.clone();
    const s0 = mesh.scale.x;
    this.anims.push(
      new CallbackAnim(
        dur,
        (k) => {
          const e = easeInOut(k);
          mesh.position.lerpVectors(start, target, e);
          if (scaleTo !== undefined) mesh.scale.setScalar(s0 + (scaleTo - s0) * k);
        },
        onDone,
      ),
    );
  }

  // ---- end-state evaluation -------------------------------------------------

  private refreshCounter() {
    let n = 0;
    for (const q of this.queues) n += q.length;
    for (const b of this.deck) if (b) n++;
    this.hud.setRemaining(n);
  }

  private remainingBoxes(): number {
    let n = 0;
    for (const q of this.queues) n += q.length;
    for (const b of this.deck) if (b) n++;
    return n;
  }

  private unclaimedSupply() {
    const balls: Record<string, number> = {};
    const caps: Record<string, number> = {};
    for (const c of COLOR_KEYS) {
      balls[c] = 0;
      caps[c] = 0;
    }
    for (const p of this.pieces) {
      if (p.claimed || p.removed) continue;
      if (p.type === 'ball') balls[p.color]++;
      else caps[p.color]++;
    }
    return { balls, caps };
  }

  /** Greedy check: can the boxes currently on the deck all eventually finish? */
  private anyDeckCompletable(): boolean {
    const supply = this.unclaimedSupply();
    let any = false;
    for (const box of this.deck) {
      if (!box || box.state === 'capping') continue;
      const needBalls = Math.max(0, box.charge - box.count);
      const needCap = box.hasCap ? 0 : 1;
      if (supply.balls[box.color] >= needBalls && supply.caps[box.color] >= needCap) {
        any = true;
        supply.balls[box.color] -= needBalls;
        supply.caps[box.color] -= needCap;
      }
    }
    return any;
  }

  private evaluate() {
    if (this.ended) return;
    if (this.remainingBoxes() === 0) {
      this.ended = true;
      this.hud.showEnd(true);
      return;
    }
    const occupied = this.deck.filter((b) => b && b.state !== 'capping').length;
    if (occupied === 0) return; // nothing on the deck yet — player can still act
    const emptySlots = this.deck.filter((b) => b === null).length;
    const queueBoxes = this.queues.reduce((a, q) => a + q.length, 0);
    const deckFullOrNoQueue = emptySlots === 0 || queueBoxes === 0;
    if (deckFullOrNoQueue && !this.anyDeckCompletable()) {
      this.ended = true;
      this.hud.showEnd(false);
    }
  }

  // ---- loop / resize --------------------------------------------------------

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.033);

    this.physics.step(dt * 1000);
    for (const p of this.pieces) {
      if (!p.claimed && p.body) p.syncFromBody();
    }

    if (!this.ended) this.runPullLoop(dt);

    for (let i = this.anims.length - 1; i >= 0; i--) {
      if (this.anims[i].update(dt)) this.anims.splice(i, 1);
    }
    for (const b of this.deck) if (b) b.update(dt);

    if (!this.ended && this.anims.length === 0) this.evaluate();

    this.renderer.render(this.scene, this.camera);
  };

  private handleResize() {
    const w = this.parent.clientWidth || 1;
    const h = this.parent.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fitCamera();
    this.camera.updateProjectionMatrix();
  }

  private fitCamera() {
    const centerY = VIEW_CENTER_Y;
    const halfH = VIEW_HALF_HEIGHT;
    const halfW = HALF_WIDTH + 0.4;
    const fovV = THREE.MathUtils.degToRad(this.camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect);
    const dV = halfH / Math.tan(fovV / 2);
    const dH = halfW / Math.tan(fovH / 2);
    const D = Math.max(dV, dH) * 1.06;
    this.camera.position.set(0, centerY, D);
    this.camera.lookAt(0, centerY, 0);
  }

  // ---- lifecycle ------------------------------------------------------------

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    this.resizeObserver.disconnect();
    for (const p of this.pieces) {
      p.mesh.parent?.remove(p.mesh);
    }
    this.pieces.length = 0;
    for (const q of this.queues) for (const b of q) b.dispose();
    for (const b of this.deck) if (b) b.dispose();
    this.queues = [];
    this.deck = [];
    this.scenery.dispose();
    this.resources.dispose();
    this.physics.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// ---- helpers ----------------------------------------------------------------

function spread(n: number, span: number): number[] {
  if (n <= 1) return [0];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(-span / 2 + (i * span) / (n - 1));
  return out;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

const GRID_MARGIN = 0.15;

/** Map a container-grid cell to a world spawn position inside the jar. */
function cellToWorld(col: number, row: number, type: 'ball' | 'cap'): { x: number; y: number } {
  const usableW = JAR.right - JAR.left - 2 * GRID_MARGIN;
  const cell = usableW / GRID_COLS;
  const x0 = JAR.left + GRID_MARGIN;
  const y0 = JAR.floorY + 0.2;
  if (type === 'cap') {
    return { x: x0 + (col + 1) * cell, y: y0 + (row + 1) * cell };
  }
  return { x: x0 + (col + 0.5) * cell, y: y0 + (row + 0.5) * cell };
}
