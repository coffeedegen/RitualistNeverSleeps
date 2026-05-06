import {
  PASSIVE_DATABASE,
  accumulatePassiveSnapshot,
  requirePassive,
  slicePassiveCombatTotals,
  type PassiveCombatTotals,
  type PassiveStatDelta,
} from "../data/passives";
import {
  amplifyMergedWeaponDamageProfile,
  BASE_WEAPON_INVENTORY_IDS,
  requireWeapon,
  resolveWeaponMergedStats,
  type MergedWeaponStats,
  type WeaponData,
} from "../data/weapons";
import {
  MAX_PASSIVE_SLOTS,
  MAX_WEAPON_SLOTS,
  type Player,
} from "../entities/Player";
import type { SurvivorLevelCardOffer } from "../systems/LevelUpUI";

export interface LevelOfferWeaponAccess {
  elevateWeaponByAuthoringId(id: string): boolean;
  acquireWeaponLane(id: string): boolean;
  evolveWeaponLane(baseWeaponId: string): boolean;
}

export interface LevelOfferBuilderDeps {
  player: Player;
  weaponAccess: LevelOfferWeaponAccess;
  refreshDerivedStats: () => void;
}

type OfferKind =
  | "evolution"
  | "weapon_upgrade"
  | "weapon_new"
  | "passive_new"
  | "passive_rank"
  | "stat_boost";

interface CandidateOffer {
  kind: OfferKind;
  offer: SurvivorLevelCardOffer;
}

const SURVIVOR_ACCENT_PALETTE = [
  "#ff6b81",
  "#6bc7ff",
  "#7fe0a8",
  "#ffd478",
  "#c892ff",
  "#f5f5f5",
  "#7ec8ff",
  "#ffa45c",
];

const OFFER_BASE_WEIGHT: Record<OfferKind, number> = {
  evolution: 8.5,
  weapon_upgrade: 7.2,
  passive_rank: 6.4,
  weapon_new: 5.8,
  passive_new: 5.2,
  stat_boost: 4.0,
};

const OFFER_LUCK_BONUS: Record<OfferKind, number> = {
  evolution: 0.9,
  weapon_upgrade: 0.8,
  passive_rank: 0.7,
  weapon_new: 0.55,
  passive_new: 0.45,
  stat_boost: 0.25,
};

/**
 * Builds the level-up card set from the current survivor snapshot.
 *
 * Keeping this out of `Game.ts` lets the session coordinator stay focused on
 * runtime flow while the upgrade catalog evolves independently.
 */
export class LevelOfferBuilder {
  constructor(private readonly deps: LevelOfferBuilderDeps) {}

  composeOffers(): SurvivorLevelCardOffer[] {
    const p = this.deps.player;
    const passiveSnapshot = accumulatePassiveSnapshot(p.passiveLanes);
    const combatTotals = slicePassiveCombatTotals(passiveSnapshot);

    const evolutionCards: CandidateOffer[] = [];
    const regularCards: CandidateOffer[] = [];

    const pushCandidate = (kind: OfferKind, offer: SurvivorLevelCardOffer): void => {
      const candidate: CandidateOffer = { kind, offer };
      if (kind === "evolution") {
        evolutionCards.push(candidate);
      } else {
        regularCards.push(candidate);
      }
    };

    const pushWeaponUpgradeCards = (): void => {
      for (const lane of p.weaponLanes) {
        const data = requireWeapon(lane.id);
        if (lane.level >= data.maxLevel) {
          continue;
        }

        const current = this.resolveWeaponStats(data, lane.level, combatTotals);
        const next = this.resolveWeaponStats(data, lane.level + 1, combatTotals);
        pushCandidate("weapon_upgrade", {
          accent: this.survivorAccentFromSeed(`wUpgrade:${lane.id}`),
          title: `Upgrade ${data.name}`,
          effect: describeWeaponLoopEffect(data),
          details: [
            `Level ${lane.level}/${data.maxLevel} -> ${lane.level + 1}/${data.maxLevel}`,
            formatWeaponDelta(current, next),
          ]
            .filter((part) => part.length > 0)
            .join("  "),
          applySelection: () => {
            this.deps.weaponAccess.elevateWeaponByAuthoringId(data.id);
            this.deps.refreshDerivedStats();
          },
        });
      }
    };

    const pushEvolutionCards = (): void => {
      for (const lane of p.weaponLanes) {
        const base = requireWeapon(lane.id);
        if (
          base.evolutionId === undefined ||
          base.passiveRequirement === undefined ||
          lane.level < base.maxLevel
        ) {
          continue;
        }

        if (!p.passiveMeetsRequirement(base.passiveRequirement, 1)) {
          continue;
        }

        const evolved = requireWeapon(base.evolutionId);
        pushCandidate("evolution", {
          accent: "#ff9f43",
          title: `Evolve - ${evolved.name}`,
          effect: `${base.name} evolves into ${evolved.name}`,
          details: `Need ${base.passiveRequirement} and max level ${base.maxLevel}.`,
          applySelection: () => {
            this.deps.weaponAccess.evolveWeaponLane(base.id);
            this.deps.refreshDerivedStats();
          },
        });
      }
    };

    const pushNewWeaponCards = (): void => {
      if (p.weaponLanes.length >= MAX_WEAPON_SLOTS) {
        return;
      }

      const candidateIds = BASE_WEAPON_INVENTORY_IDS.filter(
        (id) => !p.ownsWeapon(id),
      );
      for (const id of candidateIds) {
        const data = requireWeapon(id);
        pushCandidate("weapon_new", {
          accent: this.survivorAccentFromSeed(`weaponNew:${id}`),
          title: `Take ${data.name}`,
          effect: describeWeaponLoopEffect(data),
          details: `Starts at level 1. ${describeWeaponBaseStats(data, combatTotals)}.`,
          applySelection: () => {
            this.deps.weaponAccess.acquireWeaponLane(id);
            this.deps.refreshDerivedStats();
          },
        });
      }
    };

    const pushPassiveDiscoverCards = (): void => {
      if (p.passiveLanes.length >= MAX_PASSIVE_SLOTS) {
        return;
      }

      const owned = new Set(p.passiveLanes.map((lane) => lane.id));
      for (const passiveId of Object.keys(PASSIVE_DATABASE)) {
        if (owned.has(passiveId)) {
          continue;
        }

        const meta = requirePassive(passiveId);
        pushCandidate("passive_new", {
          accent: this.survivorAccentFromSeed(`passive:${passiveId}`),
          title: `Take ${meta.name}`,
          effect: `Adds ${meta.name} to your passive slots`,
          details: describePassiveDelta(meta.levelBonuses[0], meta.maxLevel),
          applySelection: () => {
            p.grantPassiveOrLevel(passiveId);
            this.deps.refreshDerivedStats();
          },
        });
      }
    };

    const pushPassiveRankCards = (): void => {
      for (const lane of p.passiveLanes) {
        const meta = requirePassive(lane.id);
        if (lane.level >= meta.maxLevel) {
          continue;
        }

        const nextBonus = meta.levelBonuses[lane.level] ?? meta.levelBonuses[meta.levelBonuses.length - 1];
        pushCandidate("passive_rank", {
          accent: this.survivorAccentFromSeed(`rank:${lane.id}:${lane.level}`),
          title: `Rank Up ${meta.name}`,
          effect: `${meta.name} gains one rank`,
          details: [
            `Current level ${lane.level}/${meta.maxLevel}`,
            describePassiveDelta(nextBonus, meta.maxLevel),
          ]
            .filter((part) => part.length > 0)
            .join("  "),
          applySelection: () => {
            p.grantPassiveOrLevel(lane.id);
            this.deps.refreshDerivedStats();
          },
        });
      }
    };

    const pushStatBoostCards = (): void => {
      pushCandidate("stat_boost", {
        accent: "#7fe0a8",
        title: "Hearty Feast",
        effect: "Raise max HP and heal now",
        details: "+15 max HP bonus. Heal 15 now.",
        applySelection: () => {
          this.deps.player.manualMaxHpBonus += 15;
          this.deps.refreshDerivedStats();
          this.deps.player.hp += 15;
          if (this.deps.player.hp > this.deps.player.maxHp) {
            this.deps.player.hp = this.deps.player.maxHp;
          }
        },
      });

      pushCandidate("stat_boost", {
        accent: "#ffd478",
        title: "Attractive Aura",
        effect: "Increase pickup magnet range",
        details: "+20 magnet range.",
        applySelection: () => {
          this.deps.player.manualMagnetBonus += 20;
          this.deps.refreshDerivedStats();
        },
      });

      pushCandidate("stat_boost", {
        accent: "#c892ff",
        title: "Fortune Surge",
        effect: "Increase luck",
        details: "+0.2 luck.",
        applySelection: () => {
          this.deps.player.manualLuckBonus += 0.2;
          this.deps.refreshDerivedStats();
        },
      });

      pushCandidate("stat_boost", {
        accent: "#f5f5f5",
        title: "Swift Stride",
        effect: "Increase move speed",
        details: "+18 flat move speed.",
        applySelection: () => {
          this.deps.player.manualMoveBonus += 18;
          this.deps.refreshDerivedStats();
        },
      });

      pushCandidate("stat_boost", {
        accent: "#6bcffb",
        title: "Scholar's Margin",
        effect: "Increase growth",
        details: "+5 baseline growth score before multipliers.",
        applySelection: () => {
          this.deps.player.manualGrowthBonus += 5;
          this.deps.refreshDerivedStats();
        },
      });
    };

    pushWeaponUpgradeCards();
    pushEvolutionCards();
    pushNewWeaponCards();
    pushPassiveDiscoverCards();
    pushPassiveRankCards();
    pushStatBoostCards();

    const picked: SurvivorLevelCardOffer[] = [];
    const seenTitles = new Set<string>();

    for (const candidate of evolutionCards) {
      if (picked.length >= 3) {
        break;
      }
      picked.push(candidate.offer);
      seenTitles.add(candidate.offer.title);
    }

    const weightedRegular = this.weightAndSortOffers(regularCards, p.luck);

    for (const candidate of weightedRegular) {
      if (picked.length >= 3) {
        break;
      }
      if (seenTitles.has(candidate.offer.title)) {
        continue;
      }
      seenTitles.add(candidate.offer.title);
      picked.push(candidate.offer);
    }

    let emergencySerial = 0;
    while (picked.length < 3) {
      emergencySerial += 1;
      picked.push({
        accent: "#7fe0a8",
        title: `Emergency ration ${emergencySerial}`,
        effect: "Restore survivability",
        details: "+10 max HP bonus and immediate healing.",
        applySelection: () => {
          this.deps.player.manualMaxHpBonus += 10;
          this.deps.refreshDerivedStats();
          this.deps.player.hp += 10;
          if (this.deps.player.hp > this.deps.player.maxHp) {
            this.deps.player.hp = this.deps.player.maxHp;
          }
        },
      });
    }

    return picked.slice(0, 3);
  }

  private weightAndSortOffers(
    offers: CandidateOffer[],
    luck: number,
  ): CandidateOffer[] {
    const luckBonus = Math.max(0, luck - 1);

    return [...offers]
      .map((candidate) => {
        const weight =
          OFFER_BASE_WEIGHT[candidate.kind] +
          luckBonus * OFFER_LUCK_BONUS[candidate.kind];
        const safeWeight = Math.max(0.25, weight);
        const randomKey = -Math.log(Math.max(Math.random(), Number.EPSILON)) / safeWeight;
        return { candidate, randomKey };
      })
      .sort((a, b) => a.randomKey - b.randomKey)
      .map((entry) => entry.candidate);
  }

  private resolveWeaponStats(
    data: WeaponData,
    weaponLevel: number,
    combatTotals: PassiveCombatTotals,
  ): MergedWeaponStats {
    const merged = resolveWeaponMergedStats(
      data,
      weaponLevel,
      combatTotals.passiveAmountBonus,
    );
    return amplifyMergedWeaponDamageProfile(merged, combatTotals);
  }

  private survivorAccentFromSeed(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return SURVIVOR_ACCENT_PALETTE[hash % SURVIVOR_ACCENT_PALETTE.length]!;
  }
}

function describeWeaponLoopEffect(data: WeaponData): string {
  switch (data.loopKind) {
    case "whip_arc":
      return "Lashes in a wide front arc";
    case "magic_barrage":
      return "Fires shots at the nearest enemy";
    case "knife_stream":
      return "Throws knives straight ahead";
    case "axe_lob":
      return "Throws arcing axes through enemies";
    case "cross_quartet":
      return "Throws a cross that can bounce between targets";
    case "bible_orbit":
      return "Orbits one projectile around you";
    case "fire_fan":
      return "Launches fire shots in a spread";
    case "garlic_aura":
      return "Damages nearby enemies continuously";
    case "santa_pools":
      return "Creates dangerous pools on the ground";
    case "rune_piercing":
      return "Fires piercing runes through enemies";
    case "lightning_bolt":
      return "Calls down lightning at range";
    case "pentagram_shock":
      return "Unleashes a battlefield shockwave";
    default:
      return "Changes how it attacks";
  }
}

function describeWeaponBaseStats(data: WeaponData, combatTotals: PassiveCombatTotals): string {
  const stats = amplifyMergedWeaponDamageProfile(
    resolveWeaponMergedStats(data, 1, combatTotals.passiveAmountBonus),
    combatTotals,
  );

  const fragments = [
    `Damage ${formatNumber(stats.damage, 0)}`,
    `Cooldown ${formatNumber(stats.cooldownMs, 0)}ms`,
    `Area ${formatNumber(stats.areaMultiplier, 2)}x`,
  ];

  if (Math.abs(stats.durationMultiplier - 1) > 0.0001) {
    fragments.push(`Duration ${formatNumber(stats.durationMultiplier, 2)}x`);
  }

  return fragments.join(", ");
}

function formatWeaponDelta(
  current: MergedWeaponStats,
  next: MergedWeaponStats,
): string {
  const deltas = [
    formatStatArrow("Damage", current.damage, next.damage, 0),
    formatStatArrow("Cooldown", current.cooldownMs, next.cooldownMs, 0, "ms"),
    formatStatArrow("Area", current.areaMultiplier, next.areaMultiplier, 2, "x"),
    formatStatArrow("Speed", current.speedMultiplier, next.speedMultiplier, 2, "x"),
    formatStatArrow("Duration", current.durationMultiplier, next.durationMultiplier, 2, "x"),
    formatStatArrow("Count", current.count, next.count, 0),
  ].filter((part) => part.length > 0);

  return deltas.join("  ");
}

function formatStatArrow(
  label: string,
  before: number,
  after: number,
  digits: number,
  suffix = "",
): string {
  if (before === after) {
    return "";
  }

  return `${label} ${formatNumber(before, digits)}${suffix} -> ${formatNumber(after, digits)}${suffix}`;
}

function describePassiveDelta(
  delta: PassiveStatDelta | undefined,
  maxLevel: number,
): string {
  if (delta === undefined) {
    return `Max level ${maxLevel}.`;
  }

  const fragments: string[] = [];
  if (delta.mightPct !== undefined) {
    fragments.push(`Weapon damage ${formatSignedPercent(delta.mightPct)}`);
  }
  if (delta.cooldownPct !== undefined) {
    const cooldownPct = formatPercentAbs(delta.cooldownPct);
    fragments.push(
      delta.cooldownPct < 0
        ? `Cooldown reduced by ${cooldownPct}`
        : `Cooldown increased by ${cooldownPct}`,
    );
  }
  if (delta.areaPct !== undefined) {
    fragments.push(`Area ${formatSignedPercent(delta.areaPct)}`);
  }
  if (delta.projectileSpeedPct !== undefined) {
    fragments.push(`Projectile speed ${formatSignedPercent(delta.projectileSpeedPct)}`);
  }
  if (delta.durationPct !== undefined) {
    fragments.push(`Duration ${formatSignedPercent(delta.durationPct)}`);
  }
  if (delta.amountFlat !== undefined) {
    fragments.push(`Amount ${formatSignedNumber(delta.amountFlat)}`);
  }
  if (delta.armorFlat !== undefined) {
    fragments.push(`Armor ${formatSignedNumber(delta.armorFlat)}`);
  }
  if (delta.maxHpPct !== undefined) {
    fragments.push(`Max HP ${formatSignedPercent(delta.maxHpPct)}`);
  }
  if (delta.recoveryPerSec !== undefined) {
    fragments.push(`Regen ${formatSignedNumber(delta.recoveryPerSec)}/s`);
  }
  if (delta.moveSpeedPct !== undefined) {
    fragments.push(`Move speed ${formatSignedPercent(delta.moveSpeedPct)}`);
  }
  if (delta.magnetPct !== undefined) {
    fragments.push(`Magnet ${formatSignedPercent(delta.magnetPct)}`);
  }
  if (delta.luckFlat !== undefined) {
    fragments.push(`Luck ${formatSignedNumber(delta.luckFlat)}`);
  }
  if (delta.growthPct !== undefined) {
    fragments.push(`Growth ${formatSignedPercent(delta.growthPct)}`);
  }
  if (delta.greedPct !== undefined) {
    fragments.push(`Greed ${formatSignedPercent(delta.greedPct)}`);
  }
  if (delta.cursePct !== undefined) {
    fragments.push(`Curse ${formatSignedPercent(delta.cursePct)}`);
  }

  if (fragments.length === 0) {
    return `Max level ${maxLevel}.`;
  }

  return `${fragments.join("  ")}.`;
}

function formatSignedPercent(value: number): string {
  const percent = Math.abs(value) * 100;
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatNumber(percent, percent % 1 === 0 ? 0 : 1)}%`;
}

function formatSignedNumber(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatNumber(Math.abs(value), Math.abs(value) % 1 === 0 ? 0 : 1)}`;
}

function formatPercentAbs(value: number): string {
  const percent = Math.abs(value) * 100;
  return `${formatNumber(percent, percent % 1 === 0 ? 0 : 1)}%`;
}

function formatNumber(value: number, digits: number): string {
  return value.toFixed(digits);
}
