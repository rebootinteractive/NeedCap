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

export interface LevelData {
  id: string;
  name: string;
  /** number of deck slots available at once */
  deckSlots: number;
  queues: QueueDef[];
  container: ContainerColor[];
}
