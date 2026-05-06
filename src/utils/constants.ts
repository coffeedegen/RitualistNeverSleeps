/** Maximum delta-time per tick (ms) to prevent spiral-of-death on blur. */
export const MAX_DELTA_TIME_MS = 100;

/** World units per checker tile side. */
export const CHECKER_TILE_SIZE_PX = 64;

/** Default canvas dimension fallbacks before resize (logical pixels). */
export const CANVAS_DEFAULT_WIDTH_PX = 960;
export const CANVAS_DEFAULT_HEIGHT_PX = 540;

/** Player baseline move speed in world units per second. */
export const PLAYER_BASE_MOVE_SPEED = 240;

/** Placeholder hit proxy radius for Phase-1 player rendering. */
export const PLAYER_RADIUS_PX = 12;

/** Checkerboard tile colors for the procedural ground plane. */
export const CHECKERBOARD_COLOR_A = "#1a2233";

export const CHECKERBOARD_COLOR_B = "#141824";

/** Broad-phase grid cell size (world px) — keep aligned with {@link SPATIAL_HASH_CELL_PX}. */
export const SPATIAL_HASH_CELL_PX = 64;

/** Pre-warmed capacity for enemies on the field. */
export const OBJECT_POOL_CAPACITY_ENEMY = 500;

/** Target placeholder capacity for projectiles (Phase 3 wiring). */
export const OBJECT_POOL_CAPACITY_PROJECTILE = 2000;

/** Minimum ms between automatic bat spawns while pool has capacity. */
export const ENEMY_SPAWN_INTERVAL_MS = 450;

/** Extra padding beyond the strict camera viewport when picking spawn edges. */
export const ENEMY_SPAWN_OUTSIDE_PADDING_PX = 32;

/** Linear HP scaling factor per elapsed in-game minute. */
export const DIFFICULTY_HP_PER_MINUTE = 0.1;

/** Linear speed scaling factor per elapsed in-game minute. */
export const DIFFICULTY_SPEED_PER_MINUTE = 0.05;

/** Placeholder silhouette color for authoring id `bat` until sprite sheets arrive. */
export const ENEMY_BAT_PLACEHOLDER_FILL = "#b84a52";

/** Pooled pickups kept on-screen after enemy deaths. */
export const OBJECT_POOL_CAPACITY_GEM = 1200;

/** Pooled stage pickups / utility drops spawned from enemy deaths. */
export const OBJECT_POOL_CAPACITY_PICKUP = 120;

/** Baseline projectile travel speed before weapon multipliers tweak it. */
export const PROJECTILE_BASE_SPEED_WORLD_PX_PER_SEC = 520;

/** Default Arcane Bolt shot radius prior to projectile-specific tuning. */
export const PROJECTILE_WAND_RADIUS_PX = 5;

/** Lash perpendicular reach baseline before `{@link WeaponData.baseArea}` multiplies it. */
export const WHIP_REACH_WORLD_PX = 110;

/** Lash strip thickness orthogonal to the attack direction (`baseArea` widens/thins it). */
export const WHIP_STRIP_HALF_THICK_WORLD_PX = 22;

/** XP gem visuals + pickup radii authored here until sprites land. */
export const GEM_RADIUS_PX = 6;

export const GEM_PLACEHOLDER_FILL = "#73e38c";

export const GEM_DROP_VALUE_BASIC = 1;

export const GEM_ELITE_VALUE = 5;

/** Visual accent for pooled Arcane Bolt shots. */
export const PROJECTILE_WAND_FILL = "#ffc46b";

/** Floating combat text duration + motion tuning. */
export const DAMAGE_FLOATER_LIFE_MS = 780;

export const DAMAGE_FLOAT_DRIFT_WORLD_PX_PER_SEC = -48;

/** Player onboarding stats before passive modifiers land heavily in Phase 4. */
export const PLAYER_START_MAX_HP = 100;

export const PLAYER_START_MAGNET_PX = 84;

/** Linear XP multiplier on collected gem totals before growth stat applies. */
export const PLAYER_DEFAULT_GROWTH = 2;

export const PLAYER_START_LUCK = 1;

export const LEVEL_CARD_OFFER_COUNT = 3;

export const INITIAL_WHIP_WEAPON_LEVEL = 1;

export const INITIAL_WAND_WEAPON_LEVEL = 1;

/** Inflates melee query boxes so large enemy radii remain within broad-phase candidates. */
export const ENEMY_SPATIAL_QUERY_INFLATE_PX = 52;

/** TTL for prototype Arcane Bolt bolts (ms). */
export const MAGIC_WAND_PROJECTILE_TTL_MS = 5200;

/** Fan spread per extra projectile when `baseCount` emits multiple bolts. */
export const MAGIC_WAND_MULTI_SHOT_SPREAD_RAD = 0.18;

/** Global gravity injected into lobbed weapons / arcing payloads. */
export const PROJECTILE_DOWNWARD_GRAVITY_PPS2 = 420;

/** Survivor-relative elite tuning for HP / pacing. */
export const ELITE_HEALTH_MULTIPLIER = 1.65;

export const ELITE_SPEED_MULTIPLIER = 1.12;

export const ELITE_RADIUS_MULTIPLIER = 1.2;
