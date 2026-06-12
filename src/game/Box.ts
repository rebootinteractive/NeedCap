import * as THREE from 'three';
import type { BoxDef, ColorKey } from '../shared/types';
import { COLOR_HEX } from '../shared/colors';
import { BOX_SIZE, BOX_DEPTH } from './config';
import type { Resources } from './Resources';

export type BoxState = 'queue' | 'flying' | 'deck' | 'capping' | 'done';

const WALL = 0.1;

/** A box that fills with balls, then takes a cap, then pops. */
export class Box {
  readonly color: ColorKey;
  readonly charge: number;
  count = 0;
  hasCap = false;
  state: BoxState = 'queue';
  // transient pull bookkeeping (managed by GameApp)
  cooldown = 0;
  pulling = false;

  readonly group = new THREE.Group();
  private cupMat: THREE.MeshStandardMaterial;
  private label: THREE.Sprite;
  private labelTex: THREE.CanvasTexture;
  private labelCanvas: HTMLCanvasElement;
  private geometries: THREE.BufferGeometry[] = [];
  private collected: THREE.Mesh[] = [];
  private lid: THREE.Mesh | null = null;
  private pulseT = 0;

  constructor(def: BoxDef, private res: Resources) {
    this.color = def.color;
    this.charge = def.charge;
    this.cupMat = new THREE.MeshStandardMaterial({
      color: COLOR_HEX[def.color],
      roughness: 0.45,
      metalness: 0.05,
      emissive: new THREE.Color(COLOR_HEX[def.color]),
      emissiveIntensity: 0.0,
    });
    this.buildCup();
    [this.labelCanvas, this.labelTex, this.label] = this.buildLabel();
    this.group.add(this.label);
    this.updateLabel();
  }

  private addMesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
    this.geometries.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  private buildCup() {
    const h = BOX_SIZE;
    const d = BOX_DEPTH;
    const half = h / 2;
    // floor
    this.addMesh(new THREE.BoxGeometry(h, WALL, d), this.cupMat, 0, -half + WALL / 2, 0);
    // left / right walls
    this.addMesh(new THREE.BoxGeometry(WALL, h, d), this.cupMat, -half + WALL / 2, 0, 0);
    this.addMesh(new THREE.BoxGeometry(WALL, h, d), this.cupMat, half - WALL / 2, 0, 0);
    // back wall (open toward camera, +z)
    this.addMesh(new THREE.BoxGeometry(h, h, WALL), this.cupMat, 0, 0, -d / 2 + WALL / 2);
  }

  private buildLabel(): [HTMLCanvasElement, THREE.CanvasTexture, THREE.Sprite] {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.9, 0.45, 1);
    sprite.position.set(0, BOX_SIZE / 2 + 0.32, 0.2);
    return [canvas, tex, sprite];
  }

  private updateLabel() {
    const ctx = this.labelCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = 'bold 40px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.count >= this.charge ? '#58e1c4' : '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 6;
    const txt = `${this.count}/${this.charge}`;
    ctx.strokeText(txt, 64, 34);
    ctx.fillText(txt, 64, 34);
    this.labelTex.needsUpdate = true;
  }

  setPosition(x: number, y: number, z = 0) {
    this.group.position.set(x, y, z);
  }

  get isCharged(): boolean {
    return this.count >= this.charge;
  }

  /** Add one collected ball to the cup interior; returns true if now charged. */
  addBall(): boolean {
    const idx = this.count;
    this.count++;
    const miniR = (this.res.miniBallGeo.parameters.radius as number) ?? 0.16;
    const cols: number = 2;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const spanX = BOX_SIZE - 2 * WALL - miniR * 2;
    const x = cols === 1 ? 0 : -spanX / 2 + col * spanX;
    const y = -BOX_SIZE / 2 + WALL + miniR + row * (miniR * 2 + 0.02);
    const m = new THREE.Mesh(this.res.miniBallGeo, this.res.ballMaterial(this.color));
    m.position.set(x, Math.min(y, BOX_SIZE / 2 - miniR), 0.08);
    m.castShadow = true;
    this.group.add(m);
    this.collected.push(m);
    this.updateLabel();
    return this.isCharged;
  }

  /** Drop a cap lid onto the box. */
  setCap() {
    this.hasCap = true;
    const geo = new THREE.BoxGeometry(BOX_SIZE + 0.06, 0.2, BOX_DEPTH + 0.06);
    this.geometries.push(geo);
    this.lid = new THREE.Mesh(geo, this.res.capMaterial(this.color));
    this.lid.position.set(0, BOX_SIZE / 2 + 0.1, 0);
    this.lid.castShadow = true;
    this.group.add(this.lid);
    this.cupMat.emissiveIntensity = 0;
  }

  /** Per-frame visual update — glow pulse while charged and waiting for a cap. */
  update(dt: number) {
    if (this.isCharged && !this.hasCap) {
      this.pulseT += dt;
      this.cupMat.emissiveIntensity = 0.25 + 0.25 * Math.sin(this.pulseT * 6);
      this.label.position.y = BOX_SIZE / 2 + 0.32 + 0.04 * Math.sin(this.pulseT * 6);
    }
  }

  dispose() {
    this.group.parent?.remove(this.group);
    for (const g of this.geometries) g.dispose();
    this.geometries.length = 0;
    this.cupMat.dispose();
    this.labelTex.dispose();
    (this.label.material as THREE.SpriteMaterial).dispose();
    this.collected.length = 0;
    this.lid = null;
  }
}
