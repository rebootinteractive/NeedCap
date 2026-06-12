import type { LevelData } from '../shared/types';

// Each level's container holds EXACTLY enough balls + caps to clear every box:
//   balls(color) === sum of charges of that color's boxes
//   caps(color)  === number of boxes of that color
// That makes each one a tight, fully solvable puzzle.

const level1: LevelData = {
  id: 'l1-first-cap',
  name: '1 · First Cap',
  deckSlots: 3,
  queues: [{ boxes: [{ color: 'red', charge: 3 }] }],
  container: [{ color: 'red', balls: 3, caps: 1 }],
};

const level2: LevelData = {
  id: 'l2-two-lines',
  name: '2 · Two Lines',
  deckSlots: 3,
  queues: [
    { boxes: [{ color: 'red', charge: 4 }, { color: 'blue', charge: 3 }] },
    { boxes: [{ color: 'blue', charge: 4 }, { color: 'red', charge: 3 }] },
  ],
  container: [
    { color: 'red', balls: 7, caps: 2 },
    { color: 'blue', balls: 7, caps: 2 },
  ],
};

const level3: LevelData = {
  id: 'l3-triple-sort',
  name: '3 · Triple Sort',
  deckSlots: 4,
  queues: [
    {
      boxes: [
        { color: 'red', charge: 3 },
        { color: 'green', charge: 4 },
        { color: 'blue', charge: 3 },
      ],
    },
    {
      boxes: [
        { color: 'blue', charge: 4 },
        { color: 'red', charge: 5 },
        { color: 'green', charge: 3 },
      ],
    },
    {
      boxes: [
        { color: 'green', charge: 5 },
        { color: 'blue', charge: 4 },
        { color: 'red', charge: 4 },
      ],
    },
  ],
  container: [
    { color: 'red', balls: 12, caps: 3 },
    { color: 'green', balls: 12, caps: 3 },
    { color: 'blue', balls: 11, caps: 3 },
  ],
};

export const BUILTIN_LEVELS: LevelData[] = [level1, level2, level3];
