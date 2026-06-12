# NeedCap — approved design (2026-06-12)

A physics-flavored color-sorting puzzle. Inspiration: *This Is Blast!* (Voodoo) for
the clean, chunky look — borrowed as feel, not cloned.

## Layout (top → bottom)
- **Container (jar):** a 2D physics space where colored **balls** and bigger
  rectangular **caps** (≈ a 2×2 ball footprint, one solid piece) tumble and settle
  together. A glowing **pull line** sits near the bottom.
- **Deck:** a row of slots (default 5, per-level `deckSlots`). Each slot holds one
  box until it's finished.
- **Queues:** 3–4 columns of colored boxes. Only the **front** box of each queue
  is playable.

## Core loop
- **Tap a queue** → its front box flies into the first empty deck slot (automatic
  placement).
- Pulling is **fully automatic**: any ball of a deck box's color that has settled
  **below the pull line** is sucked into it until the box reaches its **charge**.
- A charged box then waits for a matching **cap** below the line; when it grabs one
  the box **seals, pops, and frees its slot**. Caps only get pulled after charge.
- **Physics on in the jar; physics off the moment a piece is pulled** — it becomes a
  scripted glide into the box.

## Win / lose
- **Win:** clear every box from every queue. Container holds an exactly-solvable set.
- **Lose:** **deck deadlock** — every deck slot holds a box that can never finish
  (its remaining balls/caps don't exist). Detected automatically → restart offered.

## Visual
- 2.5D: perspective camera, 3D spheres + rounded cap boxes, soft shadows on a backdrop.
- Phone-portrait frame.

## v1 scope
- Core loop above.
- 3 starter levels (trivial → triple-color).
- Config-style **level editor**: deck slots, per-queue boxes (color + charge),
  container ball/cap counts, with a live solvability check. Test / Copy JSON /
  Download / Save.

## Tech
- Vite + TypeScript + Three.js 0.169, **matter.js** for the 2D jar physics.
- Physics runs in scaled "physics space" (world × 60), Y-up, negative-Y gravity.
- Caps are denser than balls so they sink toward the floor (stay grabbable).
