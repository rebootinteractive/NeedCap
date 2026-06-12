import * as THREE from 'three';
import type { ColorKey } from '../shared/types';
import { COLOR_HEX, COLOR_KEYS } from '../shared/colors';
import { BALL_RADIUS, CAP_SIZE, CAP_DEPTH } from './config';

/**
 * Shared, read-only geometries + materials for the many balls and caps.
 * These are never mutated per-instance (pull animations only move position),
 * so sharing is safe. Owned and disposed once by GameApp.
 */
export class Resources {
  readonly ballGeo: THREE.SphereGeometry;
  readonly miniBallGeo: THREE.SphereGeometry;
  readonly capGeo: THREE.BoxGeometry;
  private ballMats = new Map<ColorKey, THREE.MeshStandardMaterial>();
  private capMats = new Map<ColorKey, THREE.MeshStandardMaterial>();

  constructor() {
    this.ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 20, 16);
    this.miniBallGeo = new THREE.SphereGeometry(BALL_RADIUS * 0.62, 16, 12);
    this.capGeo = new THREE.BoxGeometry(CAP_SIZE, CAP_SIZE, CAP_DEPTH);
    for (const c of COLOR_KEYS) {
      this.ballMats.set(
        c,
        new THREE.MeshStandardMaterial({
          color: COLOR_HEX[c],
          roughness: 0.35,
          metalness: 0.0,
        }),
      );
      this.capMats.set(
        c,
        new THREE.MeshStandardMaterial({
          color: COLOR_HEX[c],
          roughness: 0.5,
          metalness: 0.05,
        }),
      );
    }
  }

  ballMaterial(c: ColorKey): THREE.MeshStandardMaterial {
    return this.ballMats.get(c)!;
  }
  capMaterial(c: ColorKey): THREE.MeshStandardMaterial {
    return this.capMats.get(c)!;
  }

  dispose() {
    this.ballGeo.dispose();
    this.miniBallGeo.dispose();
    this.capGeo.dispose();
    for (const m of this.ballMats.values()) m.dispose();
    for (const m of this.capMats.values()) m.dispose();
    this.ballMats.clear();
    this.capMats.clear();
  }
}
