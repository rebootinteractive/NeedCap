import * as THREE from 'three';
import { JAR, HALF_WIDTH } from './config';

/**
 * Static visuals: backdrop (catches soft shadows), the glass jar walls + floor
 * lip, and the glowing pull line. Owned + disposed by GameApp.
 */
export class Scenery {
  readonly group = new THREE.Group();
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  pullLineMat!: THREE.MeshBasicMaterial;

  constructor(private topY: number = JAR.topY) {
    this.build();
  }

  private add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
    this.geos.push(geo);
    if (!this.mats.includes(mat)) this.mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  private build() {
    // Backdrop — receives shadows for the toy-like look. Tall enough to cover
    // the whole jar even when the walls run off-screen.
    const backH = this.topY + 8;
    const backMat = new THREE.MeshStandardMaterial({ color: 0x171a24, roughness: 1 });
    const back = this.add(new THREE.PlaneGeometry(HALF_WIDTH * 2 + 2.4, backH), backMat, 0, this.topY / 2, -0.7);
    back.receiveShadow = true;

    // Jar side walls (slim glassy pillars).
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x39405a,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
    });
    const h = this.topY - JAR.floorY;
    const cy = (this.topY + JAR.floorY) / 2;
    const lw = this.add(new THREE.BoxGeometry(JAR.wall, h, 0.9), wallMat, JAR.left, cy, 0);
    lw.castShadow = false;
    const rw = this.add(new THREE.BoxGeometry(JAR.wall, h, 0.9), wallMat, JAR.right, cy, 0);
    rw.castShadow = false;

    // Translucent back glass of the jar (subtle).
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x2a3047,
      roughness: 0.2,
      metalness: 0.0,
      transparent: true,
      opacity: 0.25,
    });
    const glass = this.add(
      new THREE.BoxGeometry(JAR.right - JAR.left, h, 0.1),
      glassMat,
      0,
      cy,
      -0.45,
    );
    glass.receiveShadow = true;

    // Jar floor lip (dispenser mouth).
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0x4a5270,
      roughness: 0.4,
      metalness: 0.2,
    });
    this.add(new THREE.BoxGeometry(JAR.right - JAR.left + 0.3, 0.12, 0.9), lipMat, 0, JAR.floorY, 0);

    // Pull line — glowing accent band marking the grab threshold.
    this.pullLineMat = new THREE.MeshBasicMaterial({
      color: 0x58e1c4,
      transparent: true,
      opacity: 0.45,
    });
    this.mats.push(this.pullLineMat);
    const pl = new THREE.Mesh(new THREE.BoxGeometry(JAR.right - JAR.left, 0.04, 0.5), this.pullLineMat);
    this.geos.push((pl.geometry as THREE.BufferGeometry));
    pl.position.set(0, JAR.pullLineY, 0.2);
    this.group.add(pl);
  }

  dispose() {
    this.group.parent?.remove(this.group);
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.geos.length = 0;
    this.mats.length = 0;
  }
}
