# Contributed levels

Every `.json` file in this folder automatically becomes a playable level in the
menu — no code changes needed.

## How to add a level you designed

1. Open the **level editor** in the app ("+ Create New Level" on the menu).
2. Build your level, then hit **↓ Download** — your browser saves a `.json` file.
3. Drop that file into this folder (`src/levels/contributed/`).
4. Commit and push. GitHub Pages auto-redeploys and your level shows up in the list.

## Format

Each file is one `LevelData` object:

```json
{
  "id": "custom-...",
  "name": "My Level",
  "deckSlots": 4,
  "queues": [
    { "boxes": [ { "color": "red", "charge": 3 } ] }
  ],
  "container": [
    { "color": "red", "balls": 3, "caps": 1 }
  ]
}
```

Keep it solvable: for each color, the number of `balls` should be at least the
sum of that color's box `charge` values, and `caps` at least the number of boxes
of that color.
