import * as THREE from 'three';
import type { BoxDef, ColorKey } from '../shared/types';
import { COLOR_HEX } from '../shared/colors';
import { BOX_SIZE, BOX_DEPTH, GLOBAL_CHARGE } from './config';
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
  private frameMat: THREE.MeshStandardMaterial;
  private backMat: THREE.MeshStandardMaterial;
  private fillMat: THREE.MeshStandardMaterial;
  private fill: THREE.Mesh;
  private label: THREE.Sprite;
  private labelTex: THREE.CanvasTexture;
  private labelCanvas: HTMLCanvasElement;
  private geometries: THREE.BufferGeometry[] = [];
  private lid: THREE.Mesh | null = null;
  private pulseT = 0;

  // fill geometry anchoring
  private readonly bottomInner = -BOX_SIZE / 2 + WALL;
  private readonly fillFullH = BOX_SIZE - WALL - 0.04;

  constructor(def: BoxDef, private res: Resources) {
    this.color = def.color;
    this.charge = GLOBAL_CHARGE;

    const hex = COLOR_HEX[def.color];
    this.frameMat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0.05 });
    this.backMat = new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.9 });
    this.fillMat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.35,
      emissive: new THREE.Color(hex),
      emissiveIntensity: 0.12,
    });

    this.buildCup();
    this.fill = this.buildFill();
    this.group.add(this.fill);
    [this.labelCanvas, this.labelTex, this.label] = this.buildLabel();
    this.group.add(this.label);
    this.applyFill();
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
    // floor + side walls in the box colour (colour identity)
    this.addMesh(new THREE.BoxGeometry(h, WALL, d), this.frameMat, 0, -half + WALL / 2, 0);
    this.addMesh(new THREE.BoxGeometry(WALL, h, d), this.frameMat, -half + WALL / 2, 0, 0);
    this.addMesh(new THREE.BoxGeometry(WALL, h, d), this.frameMat, half - WALL / 2, 0, 0);
    // dark back wall so the empty interior reads dark and the fill stands out
    this.addMesh(new THREE.BoxGeometry(h, h, WALL), this.backMat, 0, 0, -d / 2 + WALL / 2);
  }

  private buildFill(): THREE.Mesh {
    const w = BOX_SIZE - 2 * WALL - 0.04;
    const d = BOX_DEPTH - 2 * WALL;
    const geo = new THREE.BoxGeometry(w, this.fillFullH, d);
    this.geometries.push(geo);
    const m = new THREE.Mesh(geo, this.fillMat);
    m.castShadow = false;
    m.receiveShadow = false;
    m.position.z = 0.04;
    return m;
  }

  /** Scale + position the fill bar to match count/charge. */
  private applyFill() {
    const frac = Math.max(0.0001, this.count / this.charge);
    this.fill.scale.y = frac;
    this.fill.position.y = this.bottomInner + (this.fillFullH * frac) / 2;
    this.fill.visible = this.count > 0;
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
    sprite.position.set(0, BOX_SIZE / 2 + 0.34, 0.2);
    return [canvas, tex, sprite];
  }

  private updateLabel() {
    const ctx = this.labelCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = 'bold 38px -apple-system, Helvetica, Arial, sans-serif';
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

  /** Add one collected ball; returns true if now charged. */
  addBall(): boolean {
    this.count++;
    this.applyFill();
    this.updateLabel();
    return this.isCharged;
  }

  /** Drop a cap lid onto the box. */
  setCap() {
    this.hasCap = true;
    const geo = new THREE.BoxGeometry(BOX_SIZE + 0.06, 0.2, BOX_DEPTH + 0.06);
    this.geometries.push(geo);
    this.lid = new THREE.Mesh(geo, this.frameMat);
    this.lid.position.set(0, BOX_SIZE / 2 + 0.1, 0);
    this.lid.castShadow = true;
    this.group.add(this.lid);
    this.fillMat.emissiveIntensity = 0.12;
  }

  /** Per-frame visual update — glow pulse while charged and waiting for a cap. */
  update(dt: number) {
    if (this.isCharged && !this.hasCap) {
      this.pulseT += dt;
      this.fillMat.emissiveIntensity = 0.4 + 0.35 * Math.sin(this.pulseT * 7);
      this.label.position.y = BOX_SIZE / 2 + 0.34 + 0.04 * Math.sin(this.pulseT * 7);
    }
  }

  dispose() {
    this.group.parent?.remove(this.group);
    for (const g of this.geometries) g.dispose();
    this.geometries.length = 0;
    this.frameMat.dispose();
    this.backMat.dispose();
    this.fillMat.dispose();
    this.labelTex.dispose();
    (this.label.material as THREE.SpriteMaterial).dispose();
    this.lid = null;
  }
}
