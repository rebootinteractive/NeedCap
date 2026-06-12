import * as THREE from 'three';

/** A frame-stepped animation. update() returns true when finished. */
export interface Anim {
  update(dt: number): boolean;
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Move an object from its current position to `to` over `dur` seconds. */
export class MoveAnim implements Anim {
  private t = 0;
  private from: THREE.Vector3;
  constructor(
    private obj: THREE.Object3D,
    to: THREE.Vector3,
    private dur: number,
    private onDone?: () => void,
    private arcZ = 0,
  ) {
    this.from = obj.position.clone();
    this.to = to.clone();
  }
  private to: THREE.Vector3;
  update(dt: number): boolean {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    const e = easeInOut(k);
    this.obj.position.lerpVectors(this.from, this.to, e);
    if (this.arcZ) this.obj.position.z += Math.sin(k * Math.PI) * this.arcZ;
    if (k >= 1) {
      this.onDone?.();
      return true;
    }
    return false;
  }
}

/** Scale an object to zero (pop) over `dur` seconds, then call onDone. */
export class PopAnim implements Anim {
  private t = 0;
  private base: THREE.Vector3;
  constructor(
    private obj: THREE.Object3D,
    private dur: number,
    private onDone?: () => void,
  ) {
    this.base = obj.scale.clone();
  }
  update(dt: number): boolean {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    // small overshoot then collapse
    const s = k < 0.3 ? 1 + (k / 0.3) * 0.18 : (1.18) * (1 - (k - 0.3) / 0.7);
    this.obj.scale.set(this.base.x * s, this.base.y * s, this.base.z * s);
    if (k >= 1) {
      this.onDone?.();
      return true;
    }
    return false;
  }
}

/** Generic per-frame callback animation lasting `dur` seconds. */
export class CallbackAnim implements Anim {
  private t = 0;
  constructor(
    private dur: number,
    private onUpdate: (k: number) => void,
    private onDone?: () => void,
  ) {}
  update(dt: number): boolean {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    this.onUpdate(k);
    if (k >= 1) {
      this.onDone?.();
      return true;
    }
    return false;
  }
}
