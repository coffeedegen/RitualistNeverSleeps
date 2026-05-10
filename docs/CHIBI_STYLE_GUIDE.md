# High-Contrast Chibi Style Guide (Locked)

This is the canonical art-direction lock for gameplay characters and character animation sheets.
All new player/enemy gameplay sprites must follow this guide.

## Role and Context

- Target game: top-down horde survival roguelite.
- Target tone: lo-fi kawaii/chibi with high in-combat readability.
- Priority: silhouette clarity over micro-detail.

## Global Art Style

- Perspective: top-down 3.5D.
- Show top planes clearly: head crown + shoulders visible at all times.
- Lower body is foreshortened.
- Feet are small and tucked under center of gravity.
- Background: fully transparent for gameplay sprites.

## Proportions and Anatomy

- Core ratio: strict 1:1.5 head-to-body ratio.
- Head: large, rounded, expressive.
- Eyes: placed on lower half of face to preserve a larger forehead.
- Torso: pear or bean silhouette for player-facing chibi characters.
- Limbs: short/stubby, mitten-like, no finger-level detail.

## Linework and Readability

- Dual-outline system is required:
  - Outer contour: 2 px solid (`#000000` preferred, `#1A1A1A` acceptable).
  - Internal detail lines: 1 px.
- Silhouette must remain readable against noisy/chaotic backgrounds.

## Shading Rules

- Cel shading only.
- Max two shadow tiers.
- No soft gradients.
- No dithering.
- No airbrush.

## Character and Entity Specs

## 1) Player Protagonist

- Theme: chibi black cat.
- Canvas: 64 x 64.
- Sprite fill target: about 60 px height total, leaving about 4 px breathing room.
- Internal proportion target:
  - head about 24 px
  - body about 36 px
- Fur base: `#1C1C22` (not pure black).
- Highlight ramp: soft blue-gray or warm purple-gray.
- Eye focal color: one saturated luminous ramp (cyan, bright gold, or neon green).

## 2) Swarm Enemy: Bat

- Canvas: 48 x 48.
- Threat role: lesser flying mob.
- Rule: prioritize silhouette over internal detail.
- Wingspan should use most of the canvas width.
- Body core should remain small.
- Vertical placement:
  - bat body/wings in upper portion
  - leave bottom 8 to 10 px for detached shadow zone to communicate altitude

## 3) Standard Enemies (64 x 64)

These enemies intentionally break player pear-shape language for instant combat parsing.

- Mudman:
  - bottom-heavy blob
  - wide base, tapering upward
- Skeleton:
  - rigid and jagged
  - emphasize negative space
  - 2 px bone structures
- Mummy:
  - blocky cylindrical silhouette
  - rectangular stance with outstretched arms
- Mantis:
  - top-heavy and sharp
  - strong diagonals and scythe-arm language
  - intentionally less rounded than other chibi forms

## Animation and Sheet Guidance

- Keep anchor consistency across frames to avoid wobble/jitter.
- Preserve top-down read in all directions (north/east/south/west).
- Keep silhouette stability during walk cycles before adding secondary details.

## Integration Targets in This Repo

- Player:
  - `public/assets/characters/player/player_core_sheet.png`
  - `public/assets/characters/player/player_walk_4dir_4f_64.png`
- Bat:
  - `public/assets/characters/enemies/bat/bat_hover_4f_48x48.png`
- Enemies:
  - `public/assets/characters/enemies/skeleton/skeleton_anim_sheet.png`
  - `public/assets/characters/enemies/skeleton/skeleton_walk_4dir_4f_64.png`
  - `public/assets/characters/enemies/mudman/mudman_anim_sheet.png`
  - `public/assets/characters/enemies/mudman/mudman_walk_4dir_4f_64.png`
  - `public/assets/characters/enemies/mummy/mummy_anim_sheet.png`
  - `public/assets/characters/enemies/mummy/mummy_walk_4dir_4f_64.png`
  - `public/assets/characters/enemies/mantis/mantis_anim_sheet.png`
  - `public/assets/characters/enemies/mantis/mantis_walk_4dir_4f_64.png`

## Chibi Compliance Checklist (Per Sheet)

- Canvas size exactly matches target.
- Transparent background confirmed.
- 2 px outer contour and 1 px internal line discipline maintained.
- Cel-shading only, no gradient/dither.
- Top-down 3.5D read is clear.
- Entity silhouette class is preserved (player vs each enemy type).
- No animation wobble from anchor drift.
