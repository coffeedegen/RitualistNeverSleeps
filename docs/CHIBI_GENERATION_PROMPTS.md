# Chibi Generation Prompts (Wave 1)

Use with `docs/CHIBI_STYLE_GUIDE.md` as authoritative constraints.

Current blocker:
- SpriteCook account reports `0` credits, so generation calls fail until credits are available.

## Global Prompt Prefix (Append to every prompt)

`Top-down 3.5D high-contrast chibi pixel art for a horde survival roguelite, transparent background, strict 1:1.5 head-to-body where applicable, dual-outline system (2px outer contour in #1A1A1A or #000000 and 1px internal lines), crisp cel shading with maximum two shadow tiers, no gradients, no dithering, no text, stable anchor and silhouette readability against busy combat backgrounds.`

## 1) Player Cat - 4 Direction Walk Sheet

- Output: `public/assets/characters/player/player_walk_4dir_4f_64.png`
- Canvas: `256x256` (4 columns x 4 rows, each frame 64x64)
- Row order: `north, east, south, west`
- Col order: `frame1, frame2, frame3, frame4`

Prompt:
`Chibi black cat protagonist walk cycle sprite sheet. 4-direction walk, 4 frames per direction, fixed 64x64 per frame grid in a 256x256 canvas. Top-down 3.5D with visible head crown and shoulders, foreshortened lower body, tiny tucked feet. Character fill should read around 60px with breathing room. Fur base #1C1C22, highlight ramp soft blue-gray or warm purple-gray, eyes luminous cyan and expressive. Head around 24px, body around 36px. Keep consistent anchor with no wobble across all 16 frames.`

## 2) Bat Hover Sheet

- Output: `public/assets/characters/enemies/bat/bat_hover_4f_48x48.png`
- Canvas: `192x48` (4 columns x 1 row, each frame 48x48)

Prompt:
`Hostile chibi bat enemy hover animation sprite sheet, 4 frames horizontally in 192x48 with 48x48 per frame. Full wingspan silhouette uses most of frame width, small core body, limited internal detail for clarity. Keep bat in upper frame area and preserve bottom 8 to 10 pixels as empty space for detached shadow readability of flight altitude. Smooth loop: wings up, mid, down, mid.`

## 3) Skeleton 4-Direction Walk Sheet

- Output: `public/assets/characters/enemies/skeleton/skeleton_walk_4dir_4f_64.png`
- Canvas: `256x256`
- Row order: `north, east, south, west`

Prompt:
`Chibi skeleton enemy walk cycle sprite sheet, rigid and jagged silhouette, thin with visible negative space, 2px bone structures. 4 directions x 4 frames in a strict 256x256 grid with 64x64 cells. Top-down 3.5D readable at combat scale, fixed anchor across frames, no wobble.`

## 4) Mudman 4-Direction Walk Sheet

- Output: `public/assets/characters/enemies/mudman/mudman_walk_4dir_4f_64.png`
- Canvas: `256x256`
- Row order: `north, east, south, west`

Prompt:
`Chibi mudman enemy walk cycle sprite sheet, bottom-heavy blob silhouette, wide base tapering to smaller head, sticky and weighty movement feel. 4 directions x 4 frames in 256x256 with 64x64 cells. Top-down 3.5D readable, clear silhouette priority, stable anchor and spacing.`

## 5) Mummy 4-Direction Walk Sheet

- Output: `public/assets/characters/enemies/mummy/mummy_walk_4dir_4f_64.png`
- Canvas: `256x256`
- Row order: `north, east, south, west`

Prompt:
`Chibi mummy enemy walk cycle sprite sheet, blocky cylindrical body, rectangular stiff posture, outstretched arms to contrast rounded player shape. 4 directions x 4 frames in a strict 256x256 atlas using 64x64 cells, top-down 3.5D perspective, stable frame anchor and no jitter.`

## 6) Mantis 4-Direction Walk Sheet

- Output: `public/assets/characters/enemies/mantis/mantis_walk_4dir_4f_64.png`
- Canvas: `256x256`
- Row order: `north, east, south, west`

Prompt:
`Chibi mantis enemy walk cycle sprite sheet, top-heavy aggressive silhouette with sharp diagonal scythe-like forearms. Distinct from rounded chibi forms while remaining readable. 4 directions x 4 frames in 256x256 with 64x64 cells, top-down 3.5D, clean anchor and silhouette consistency across frames.`

## Generation Parameters (Recommended)

- `pixel=true`
- `bg_mode=transparent`
- `smart_crop=false`
- `variations=1` (reduce credits burn)
- `model=gemini-2.5-flash-image` for draft pass, upscale model only for finals

## Post-Generation QA

- Confirm exact dimensions for each output path.
- Confirm transparency and no matte halo.
- Confirm row/column direction-frame order.
- Confirm outline rule and cel-shading constraints.
- Confirm animation anchor stability frame-to-frame.
