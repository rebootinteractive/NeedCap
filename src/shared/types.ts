export type ColorKey = 'red' | 'blue' | 'green' | 'yellow' | 'purple';

/** A single box that sits in a queue and is sent up to the deck. */
export interface BoxDef {
  color: ColorKey;
  /** number of matching-color balls it needs before it can take a cap */
  charge: number;
}

/** A queue of boxes. boxes[0] is the FRONT (sent first). */
export interface QueueDef {
  boxes: BoxDef[];
}

/** How many balls + caps of one color start loose in the container jar. */
export interface ContainerColor {
  color: ColorKey;
  balls: number;
  caps: number;
}

/**
 * One piece placed on the container grid (Stage-2 editor output). A ball fills
 * one cell; a cap fills a 2×2 block anchored at (col,row) as its bottom-left.
 * row 0 is the bottom of the jar. These are starting positions — physics takes
 * over once the level begins.
 */
export interface PlacedPiece {
  type: 'ball' | 'cap';
  color: ColorKey;
  col: number;
  row: number;
}

export interface LevelData {
  id: string;
  name: string;
  /** number of deck slots available at once */
  deckSlots: number;
  queues: QueueDef[];
  /** derived (zero-sum) counts: balls = 10×boxes(color), caps = boxes(color) */
  container: ContainerColor[];
  /** optional arranged start layout; if absent the game clusters by colour */
  layout?: PlacedPiece[];
}
