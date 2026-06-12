// All measurements are in WORLD units (Three.js space). The physics engine runs
// in a scaled-up "physics space" (world * SCALE) so Matter.js stays in its
// well-tuned pixel-ish range. Coordinates use Y-up, matching Three.js; gravity
// is therefore negative-Y.

export const SCALE = 60; // physics units per world unit
export const GRAVITY = 1.0; // matter gravity.y magnitude (applied as -GRAVITY)
export const GRAVITY_SCALE = 0.0016;

export const HALF_WIDTH = 3.2; // playfield half width

// The jar (container) — loose balls + caps live here under physics.
export const JAR = {
  left: -3.0,
  right: 3.0,
  floorY: 4.85,
  topY: 12.8,
  wall: 0.18,
  pullLineY: 6.0, // pieces with center below this line are grabbable
};

export const BALL_RADIUS = 0.26;
export const CAP_SIZE = 1.0; // square footprint ≈ 2x2 balls
export const CAP_DEPTH = 0.5;
export const PIECE_DEPTH_JITTER = 0.0; // keep everything on z=0 plane

// Deck — row of slots that hold boxes being filled.
export const DECK_Y = 3.45;
export const BOX_SIZE = 0.92;
export const BOX_DEPTH = 0.7;

// Queues — columns of waiting boxes at the bottom. Front box = topmost.
export const QUEUE_TOP_Y = 2.75;
export const QUEUE_GAP = 0.18; // gap between stacked queue boxes (added to BOX_SIZE)

// Timing (seconds)
export const PULL_COOLDOWN = 0.14; // between successive ball grabs by one box
export const BALL_GLIDE = 0.32;
export const CAP_GLIDE = 0.4;
export const SEND_GLIDE = 0.3;
export const SHIFT_GLIDE = 0.18;
