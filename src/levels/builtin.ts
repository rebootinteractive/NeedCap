import type { LevelData } from '../shared/types';

// Charge is GLOBAL = 10: every box needs 10 matching balls before it can take a
// cap. (The `charge` fields below are kept at 10 for JSON clarity but the game
// uses the global value.) Each container holds EXACTLY enough to clear all boxes:
//   balls(color) === 10 * (number of boxes of that color)
//   caps(color)  === number of boxes of that color

const level1: LevelData = {
  id: 'l1-first-cap',
  name: '1 · First Cap',
  deckSlots: 3,
  queues: [{ boxes: [{ color: 'red', charge: 10 }] }],
  container: [{ color: 'red', balls: 10, caps: 1 }],
};

const level2: LevelData = {
  id: 'l2-two-lines',
  name: '2 · Two Lines',
  deckSlots: 3,
  queues: [
    { boxes: [{ color: 'red', charge: 10 }, { color: 'blue', charge: 10 }] },
    { boxes: [{ color: 'blue', charge: 10 }, { color: 'red', charge: 10 }] },
  ],
  container: [
    { color: 'red', balls: 20, caps: 2 },
    { color: 'blue', balls: 20, caps: 2 },
  ],
};

const level3: LevelData = {
  id: 'l3-triple-sort',
  name: '3 · Triple Sort',
  deckSlots: 4,
  queues: [
    { boxes: [{ color: 'red', charge: 10 }, { color: 'green', charge: 10 }] },
    { boxes: [{ color: 'blue', charge: 10 }, { color: 'red', charge: 10 }] },
    { boxes: [{ color: 'green', charge: 10 }, { color: 'blue', charge: 10 }] },
  ],
  container: [
    { color: 'red', balls: 20, caps: 2 },
    { color: 'green', balls: 20, caps: 2 },
    { color: 'blue', balls: 20, caps: 2 },
  ],
};

export const BUILTIN_LEVELS: LevelData[] = [level1, level2, level3];
