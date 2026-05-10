# Ritual Survival Asset Guide

This file is the single prep sheet for the game art pass.

Canonical style lock:
- `docs/CHIBI_STYLE_GUIDE.md` is the source of truth for player/enemy sprite direction.

Current status:
- The game still uses placeholder geometry for most combat actors.
- A temporary tileset now exists at `public/assets/tilesets/void_shrine_placeholder_tileset.svg`.
- The game can run without a final tilemap right now because the floor is still procedural.
- I can implement the tilemap system and loader for you later, but the art itself needs to exist first.

The player-facing content names below have been renamed to original terms while keeping the internal technical ids stable.

## Global Rules

- All gameplay sprites should be built on transparent backgrounds unless noted.
- Keep every sprite centered in its canvas.
- Leave 2 to 6 px of padding around the silhouette so rotation and scaling do not clip edges.
- Use high-contrast chibi pixel-art consistently across all gameplay actors.
- World-scale baseline:
  - Tile size: 64 x 64 px
  - Small pickup / gem sprite: 24 to 48 px
  - Standard unit sprite: 64 x 64 px
  - Large VFX sprite: 128 x 128 px
  - Full-screen burst: 256 x 256 px or larger if needed

Gameplay actor style lock (summary):
- Top-down 3.5D perspective.
- 1:1.5 head-to-body proportion.
- Dual outlines: 2 px outer contour + 1 px internal lines.
- Cel-shading only, max two shadow tiers, no gradients/dither.

## Already Referenced By Code

| Asset | Suggested size | Notes |
|---|---:|---|
| `assets/ui/ritual_logo.png` | 1024 x 1024 | Title screen / wallet splash logo. Transparent background preferred. |
| Game favicon / app icon | 512 x 512 | Simple logo mark for browser and launcher use. |

## Player

| Asset | Suggested size | Notes |
|---|---:|---|
| Player sprite | 64 x 64 | Chibi black cat. Canonical filename: `public/assets/characters/player/player_sprite_64x64.png`. |
| Player walk / run sheet | 64 x 64 per frame | Preferred runtime target: 4 directions x 4 frames. |
| Player attack overlay | 64 x 64 per frame | Only if you want visible attack animations. |
| Player hurt / flash frame | 64 x 64 | Optional, but useful for damage feedback. |

Player lock notes:
- Fur base should use `#1C1C22` (not pure black).
- Eyes should be high-saturation focal points (cyan/gold/neon green families).
- Sprite should read about 60 px tall in-canvas (with breathing room for idle motion).

## Enemies

| Enemy | Suggested size | Notes |
|---|---:|---|
| Bat | 48 x 48 | Full-width wingspan, small core body, leave bottom 8 to 10 px for detached shadow zone. |
| Skeleton | 64 x 64 | Rigid, jagged, thin silhouette with clear negative space and 2 px bones. |
| Mudman | 64 x 64 | Bottom-heavy blob silhouette, wide base tapering upward. |
| Mummy | 64 x 64 | Blocky cylindrical posture, outstretched rectangular read. |
| Mantis | 64 x 64 | Top-heavy sharp/aggressive silhouette with diagonal scythe arms. |

Recommended enemy animation minimum:
- Idle / hover: 2 to 4 frames
- Move: 4 frames
- Death: 4 frames

If you want elites:
- Add a gold outline / aura variant, not a separate full sprite sheet.

## Weapons and Evolutions

If you want to keep combat partially procedural, only the icon is required.
If you want full art for projectiles and effects, use the effect sizes below.

| Weapon | Icon size | Effect / projectile size | Notes |
|---|---:|---:|---|
| Lash | 64 x 64 | 192 x 96 | Slash arc / lash effect. |
| Crimson Lash | 64 x 64 | 192 x 96 | Same silhouette, blood-tinted. |
| Arcane Bolt | 64 x 64 | 16 x 16 | Simple bolt. |
| Sanctified Bolt | 64 x 64 | 16 x 16 | Faster / brighter bolt. |
| Shard Blade | 64 x 64 | 16 x 48 | Thin thrown blade. |
| Thousand Shards | 64 x 64 | 16 x 48 | Multi-shard variant. |
| Cleaver | 64 x 64 | 32 x 32 | Arc projectile. |
| Reaper Spiral | 64 x 64 | 32 x 32 | Stronger cleaver arc. |
| Sanctum Cross | 64 x 64 | 24 x 24 | Bouncing cross projectile. |
| Celestial Blade | 64 x 64 | 24 x 24 | Brighter cross projectile. |
| Orbiting Tome | 64 x 64 | 32 x 32 | Orbiting book sprite. |
| Nocturne Tome | 64 x 64 | 32 x 32 | Orbiting book, upgraded look. |
| Ember Wand | 64 x 64 | 24 x 24 | Fireball. |
| Inferno Burst | 64 x 64 | 24 x 24 | Larger fireball. |
| Warding Aura | 64 x 64 | 128 x 128 | Aura ring / cloud. |
| Life Drain | 64 x 64 | 128 x 128 | Stronger aura ring / cloud. |
| Sanctified Tide | 64 x 64 | 128 x 128 | Ground pool splash. |
| Deluge | 64 x 64 | 128 x 128 | Larger pool splash. |
| Rune Shard | 64 x 64 | 24 x 24 | Small tracer rune. |
| Final Sigil | 64 x 64 | 24 x 24 | Upgraded tracer rune. |
| Storm Ring | 64 x 64 | 32 x 96 | Vertical strike / lightning column. |
| Tempest Loop | 64 x 64 | 32 x 96 | Stronger strike column. |
| Sigil Nova | 64 x 64 | 256 x 256 | Screen-wide burst or ring explosion. |
| Lunar Bloom | 64 x 64 | 256 x 256 | Upgraded screen-wide burst. |

## Passives

All passive icons can use a common 64 x 64 canvas.

| Passive | Suggested size | Notes |
|---|---:|---|
| Ironleaf | 64 x 64 | Damage icon. |
| Bastion Plate | 64 x 64 | Shield / plate icon. |
| Vessel Heart | 64 x 64 | Heart icon. |
| Ruby Root | 64 x 64 | Healing / food icon. |
| Hollow Tome | 64 x 64 | Book / tome icon. |
| Flare Lantern | 64 x 64 | Candle / blast radius icon. |
| Swiftband | 64 x 64 | Speed / duration icon. |
| Timeweave | 64 x 64 | Purple book / timer icon. |
| Echo Lens | 64 x 64 | Split-shot icon. |
| Gale Wings | 64 x 64 | Movement icon. |
| Graviton Seed | 64 x 64 | Magnet icon. |
| Fortune Leaf | 64 x 64 | Luck icon. |
| Ascension Crown | 64 x 64 | Growth / XP icon. |
| Gilded Mask | 64 x 64 | Greed / coin icon. |

## Pickups

These are the pickups currently planned or implemented in the run loop.

| Pickup | Suggested size | Notes |
|---|---:|---|
| Field Ration | 48 x 48 | Heal pickup. Keep it very readable. |
| Gem Siphon | 48 x 48 | Gem vacuum pickup. |
| Halo Charm | 48 x 48 | Screen-clear pickup. |
| Chrono Seal | 48 x 48 | Time-stop pickup. |
| Essence Gem | 24 x 24 or 32 x 32 | Can be a small crystal or coin-like gem. |
| Reliquary Chest | 48 x 48 | Optional future pickup if you add chests. |

## Environment / Tilemap

### Tile Size
- Recommended tile size: 64 x 64 px
- Placeholder tileset sheet: 256 x 256 px
- Grid layout: 4 x 4 tiles

### Recommended Environment Tiles

| Tile | Suggested size | Notes |
|---|---:|---|
| Base floor | 64 x 64 | Main ground tile. |
| Cracked floor | 64 x 64 | Variation tile. |
| Moss floor | 64 x 64 | Variation tile. |
| Mud floor | 64 x 64 | Variation tile. |
| North border | 64 x 64 | Top edge. |
| South border | 64 x 64 | Bottom edge. |
| Rune floor | 64 x 64 | Ritual / magic tile. |
| Blood stain | 64 x 64 | Combat variation. |
| Altar tile | 64 x 64 | Decor / landmark tile. |
| Void tile | 64 x 64 | Dark danger tile. |
| Path tile | 64 x 64 | Vertical or horizontal walkway. |
| Gravel tile | 64 x 64 | Texture variation. |
| Water tile | 64 x 64 | Optional stage hazard or decor. |
| Grass tile | 64 x 64 | Outdoor variation. |
| Sigil tile | 64 x 64 | Special ritual marker. |
| Broken tile | 64 x 64 | Ruined stone / damage tile. |

### Props

| Prop | Suggested size | Notes |
|---|---:|---|
| Pillar | 64 x 96 | If you add stage geometry. |
| Torch / candle | 32 x 64 | Small decorative prop. |
| Statue | 64 x 128 | Landmark or map obstacle. |
| Crate / barrel | 48 x 48 | Optional clutter. |
| Bone pile | 48 x 48 | Optional clutter. |

## UI Art

| Asset | Suggested size | Notes |
|---|---:|---|
| HUD HP icon | 32 x 32 | Small HUD icon. |
| HUD XP icon | 32 x 32 | Small HUD icon. |
| HUD score icon | 32 x 32 | Small HUD icon. |
| Level-up card icon frame | 64 x 64 | Used for weapon / passive cards. |
| Game Over banner | 1024 x 256 | Big center banner. |
| Modal frame | 512 x 256 | Settings / leaderboard panels. |
| Button icon glyphs | 32 x 32 | Optional. |

## VFX

| Effect | Suggested size | Notes |
|---|---:|---|
| Hit spark | 32 x 32 | Small combat hit flash. |
| Death puff | 48 x 48 | Enemy death effect. |
| Pickup glow | 48 x 48 | Pickup collection effect. |
| Level-up burst | 256 x 256 | Big card / level-up pulse. |
| Elite aura | 96 x 96 | Optional elite outline effect. |
| Screen clear | 256 x 256 | Halo Charm / Sigil Nova / Chrono Seal-style burst. |

## Audio

Not pixel-based, but you should still prepare these if you want a full pass:

- Menu music
- Gameplay loop music
- Game over sting
- Level-up sting
- Button click
- Hover tick
- Player hit
- Enemy hit
- Enemy death
- Pickup collect
- Weapon cast / fire
- Special pickup sounds for Gem Siphon, Halo Charm, Chrono Seal

## Suggested Folder Layout

```text
public/assets/
  ui/
    ritual_logo.png
    hud/
    menus/
  characters/
    player/
    enemies/
  weapons/
    base/
    evolutions/
    effects/
  passives/
  pickups/
  tilesets/
    void_shrine_placeholder_tileset.svg
  vfx/
  audio/
```

## Practical Notes

- You do not need to prepare the tilemap code yourself. I can build the loader and rendering layer.
- You do need the final tile art or a placeholder tileset to feed into that system.
- If you want me to, I can next turn this guide into a stricter production checklist with exact filenames for every sprite and sound file.
