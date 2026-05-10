# Asset Generation Queue

Style lock:
- high-contrast chibi pixel art
- top-down 3.5D perspective
- strict 1:1.5 head-to-body for chibi actors
- 2 px outer contour + 1 px internal linework
- cel-shading only (max two shadow tiers)
- transparent background
- crisp silhouettes, 2-6 px padding
- no text

Reference:
- `docs/CHIBI_STYLE_GUIDE.md` is authoritative for all player/enemy sheets.
- `docs/CHIBI_GENERATION_PROMPTS.md` contains locked Wave 1 prompts.

Execution note:
- 2026-05-09: SpriteCook generation currently blocked (`credits_available=0`).
- Wave 1 was generated via built-in image generation fallback and normalized locally.

Statuses:
- pending
- draft_ok
- final_ok
- needs_retry
- deferred

## Wave 1 - Core Gameplay (P0)
| id | output | type | status |
|---|---|---|---|
| W1_PLAYER_CORE | `public/assets/characters/player/player_core_sheet.png` | atlas | draft_ok |
| W1_ENEMY_BAT | `public/assets/characters/enemies/bat/bat_hover_4f_48x48.png` | sheet | draft_ok |
| W1_ENEMY_SKELETON | `public/assets/characters/enemies/skeleton/skeleton_anim_sheet.png` | sheet | draft_ok |
| W1_ENEMY_MUDMAN | `public/assets/characters/enemies/mudman/mudman_anim_sheet.png` | sheet | draft_ok |
| W1_ENEMY_MUMMY | `public/assets/characters/enemies/mummy/mummy_anim_sheet.png` | sheet | draft_ok |
| W1_ENEMY_MANTIS | `public/assets/characters/enemies/mantis/mantis_anim_sheet.png` | sheet | draft_ok |

## Wave 2 - Combat Readability (P0/P1)
| id | output | type | status |
|---|---|---|---|
| W2_WEAPON_ICON_ATLAS | `public/assets/weapons/weapon_icons_64_atlas.png` | atlas | draft_ok |
| W2_PROJECTILE_16 | `public/assets/weapons/projectiles_16x16_sheet.png` | sheet | pending |
| W2_PROJECTILE_24 | `public/assets/weapons/projectiles_24x24_sheet.png` | sheet | pending |
| W2_PROJECTILE_32 | `public/assets/weapons/projectiles_32x32_sheet.png` | sheet | pending |
| W2_PROJECTILE_32x96 | `public/assets/weapons/projectiles_32x96_sheet.png` | sheet | pending |
| W2_EFFECT_128 | `public/assets/vfx/effects_128_sheet.png` | sheet | pending |
| W2_EFFECT_192x96 | `public/assets/vfx/effects_192x96_sheet.png` | sheet | pending |
| W2_EFFECT_256 | `public/assets/vfx/effects_256_sheet.png` | sheet | pending |

## Wave 3 - Passives + Pickups (P1)
| id | output | type | status |
|---|---|---|---|
| W3_PASSIVES | `public/assets/passives/passives_64_atlas.png` | atlas | draft_ok |
| W3_PICKUPS | `public/assets/pickups/pickups_atlas.png` | atlas | draft_ok |

## Wave 4 - VFX (P1)
| id | output | type | status |
|---|---|---|---|
| W4_CORE_VFX | `public/assets/vfx/vfx_small_atlas.png` | atlas | draft_ok |
| W4_VFX_MEDIUM | `public/assets/vfx/vfx_medium_atlas.png` | atlas | draft_ok |
| W4_VFX_LARGE | `public/assets/vfx/vfx_large_atlas.png` | atlas | draft_ok |

## Wave 5 - Environment + UI (P2)
| id | output | type | status |
|---|---|---|---|
| W5_TILESET | `public/assets/tilesets/ritual_tileset_64_atlas.png` | atlas | draft_ok |
| W5_PROPS | `public/assets/props/ritual_props_atlas.png` | atlas | draft_ok |
| W5_UI_ICONS | `public/assets/ui/ui_icons_atlas.png` | atlas | draft_ok |
| W5_UI_BANNERS | `public/assets/ui/ui_frames_sheet.png` | sheet | draft_ok |
