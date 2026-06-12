import type { ColorKey } from './types';

export const COLOR_KEYS: ColorKey[] = ['red', 'blue', 'green', 'yellow', 'purple'];

export const COLOR_HEX: Record<ColorKey, number> = {
  red: 0xff5b6a,
  blue: 0x4aa3ff,
  green: 0x5bd86b,
  yellow: 0xffd23f,
  purple: 0xb56bff,
};

export const COLOR_CSS: Record<ColorKey, string> = {
  red: '#ff5b6a',
  blue: '#4aa3ff',
  green: '#5bd86b',
  yellow: '#ffd23f',
  purple: '#b56bff',
};
