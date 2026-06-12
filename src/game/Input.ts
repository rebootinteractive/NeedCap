import * as THREE from 'three';

/** Maps pointer taps to a world point on the z=0 plane. */
export class Input {
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private ndc = new THREE.Vector2();
  private downX = 0;
  private downY = 0;
  private downAt = 0;

  constructor(
    private el: HTMLElement,
    private camera: THREE.Camera,
    private onTap: (p: THREE.Vector3) => void,
  ) {
    this.el.addEventListener('pointerdown', this.handleDown);
    this.el.addEventListener('pointerup', this.handleUp);
  }

  private handleDown = (e: PointerEvent) => {
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.downAt = performance.now();
  };

  private handleUp = (e: PointerEvent) => {
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    const moved = Math.hypot(dx, dy);
    const dt = performance.now() - this.downAt;
    if (moved > 16 || dt > 600) return; // ignore drags / long presses
    const rect = this.el.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.plane, hit)) {
      this.onTap(hit);
    }
  };

  detach() {
    this.el.removeEventListener('pointerdown', this.handleDown);
    this.el.removeEventListener('pointerup', this.handleUp);
  }
}
