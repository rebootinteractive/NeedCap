import Matter from 'matter-js';
import { SCALE, GRAVITY, GRAVITY_SCALE, JAR } from './config';

/**
 * Thin wrapper around a Matter.js world. Runs in physics space (world * SCALE)
 * with Y-up — gravity is negative Y so pieces fall toward the jar floor.
 */
export class Physics {
  readonly engine: Matter.Engine;
  readonly world: Matter.World;
  private walls: Matter.Body[] = [];

  constructor() {
    // More solver iterations → contacts in tall stacks resolve firmly instead
    // of letting bodies sink into each other (the "squashed" look).
    this.engine = Matter.Engine.create({
      positionIterations: 12,
      velocityIterations: 8,
      constraintIterations: 4,
    });
    this.world = this.engine.world;
    this.engine.gravity.x = 0;
    this.engine.gravity.y = -GRAVITY;
    this.engine.gravity.scale = GRAVITY_SCALE;
    this.buildWalls();
  }

  private buildWalls() {
    const t = JAR.wall * SCALE;
    const left = JAR.left * SCALE;
    const right = JAR.right * SCALE;
    const floor = JAR.floorY * SCALE;
    const top = JAR.topY * SCALE;
    const w = right - left;
    const h = top - floor;
    const cx = (left + right) / 2;
    const opts: Matter.IBodyDefinition = {
      isStatic: true,
      friction: 0.5,
      restitution: 0.05,
    };
    this.walls = [
      Matter.Bodies.rectangle(cx, floor - t / 2, w + 2 * t, t, opts), // floor
      Matter.Bodies.rectangle(left - t / 2, floor + h / 2, t, h + t, opts), // left
      Matter.Bodies.rectangle(right + t / 2, floor + h / 2, t, h + t, opts), // right
    ];
    Matter.World.add(this.world, this.walls);
  }

  addCircle(xw: number, yw: number, rw: number): Matter.Body {
    const body = Matter.Bodies.circle(xw * SCALE, yw * SCALE, rw * SCALE, {
      friction: 0.4,
      frictionStatic: 0.6,
      restitution: 0.12,
      density: 0.001,
    });
    Matter.World.add(this.world, body);
    return body;
  }

  addBox(xw: number, yw: number, sideW: number): Matter.Body {
    const s = sideW * SCALE;
    const body = Matter.Bodies.rectangle(xw * SCALE, yw * SCALE, s, s, {
      friction: 0.5,
      frictionStatic: 0.7,
      restitution: 0.08,
      // caps are heavier than balls so they settle through gaps
      density: 0.0016,
      chamfer: { radius: s * 0.18 },
    });
    Matter.World.add(this.world, body);
    return body;
  }

  remove(body: Matter.Body) {
    Matter.World.remove(this.world, body);
  }

  step(dtMs: number) {
    Matter.Engine.update(this.engine, dtMs);
  }

  dispose() {
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
  }
}
