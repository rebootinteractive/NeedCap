import * as THREE from 'three';
import Matter from 'matter-js';
import type { ColorKey } from '../shared/types';
import { SCALE } from './config';
import type { Resources } from './Resources';

export type PieceType = 'ball' | 'cap';

let nextId = 1;

/**
 * One loose object in the jar: a physics body + a 3D mesh.
 * While `claimed` is false it is driven by physics. Once a box claims it, the
 * body is removed and the mesh is animated by the game (scripted glide).
 */
export class Piece {
  readonly id = nextId++;
  readonly type: PieceType;
  readonly color: ColorKey;
  body: Matter.Body | null;
  readonly mesh: THREE.Mesh;
  claimed = false;
  removed = false;

  constructor(type: PieceType, color: ColorKey, body: Matter.Body, res: Resources) {
    this.type = type;
    this.color = color;
    this.body = body;
    if (type === 'ball') {
      this.mesh = new THREE.Mesh(res.ballGeo, res.ballMaterial(color));
    } else {
      this.mesh = new THREE.Mesh(res.capGeo, res.capMaterial(color));
    }
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.syncFromBody();
  }

  /** Copy physics transform onto the mesh (called each frame while unclaimed). */
  syncFromBody() {
    if (!this.body) return;
    this.mesh.position.set(this.body.position.x / SCALE, this.body.position.y / SCALE, 0);
    this.mesh.rotation.z = this.body.angle;
  }

  /** World-space Y of the center (used for the pull-line test). */
  centerY(): number {
    return this.body ? this.body.position.y / SCALE : this.mesh.position.y;
  }

  /** Detach from physics so the game can animate the mesh directly. */
  detachBody(remove: (b: Matter.Body) => void) {
    if (this.body) {
      remove(this.body);
      this.body = null;
    }
  }
}
