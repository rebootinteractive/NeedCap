// All measurements are in WORLD units (Three.js space). The physics engine runs
// in a scaled-up "physics space" (world * SCALE) so Matter.js stays in its
// well-tuned pixel-ish range. Coordinates use Y-up, matching Three.js; gravity
// is therefore negative-Y.

export const SCALE = 60; // physics units per world unit
export const GRAVITY = 1.0; // matter gravity.y magnitude (applied as -GRAVITY)
export const GRAVITY_SCALE = 0.0008; // gentler fall so stacks don't compress

export const HALF_WIDTH = 3.2; // playfield half width

// Every box needs this many matching balls before it can take a cap.
export const GLOBAL_CHARGE = 10;

// The jar (container) — loose balls + caps live here under physics.
// Tall jar so it can hold many balls (charge 10 per box).
export const JAR = {
  left: -3.0,
  right: 3.0,
  floorY: 4.6,
  // baseline wall top — sits above the camera frame so the jar runs off-screen;
  // GameApp raises it further when a level's pieces spawn higher.
  topY: 18.0,
  wall: 0.18,
  pullLineY: 5.95, // pieces with center below this line are grabbable
};

export const BALL_RADIUS = 0.26;
export const CAP_SIZE = 1.0; // square footprint ≈ 2x2 balls
export const CAP_DEPTH = 0.5;

// Deck — row of slots that hold boxes being filled.
export const DECK_Y = 3.35;
export const BOX_SIZE = 0.92;
export const BOX_DEPTH = 0.7;

// Queues — columns of waiting boxes at the bottom. Front box = topmost.
// Lowered so the front box clears the deck row.
export const QUEUE_TOP_Y = 2.0;
export const QUEUE_GAP = 0.16; // gap between stacked queue boxes (added to BOX_SIZE)

// Camera framing
export const VIEW_CENTER_Y = 7.6;
export const VIEW_HALF_HEIGHT = 8.1;

// Timing (seconds) — tuned snappy.
export const PULL_COOLDOWN = 0.03; // between successive ball grabs by one box
export const BALL_GLIDE = 0.16;
export const CAP_GLIDE = 0.3;
export const SEND_GLIDE = 0.28;
export const SHIFT_GLIDE = 0.16;
