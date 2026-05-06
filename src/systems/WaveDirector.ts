/** Weight table entry for spawning a specific authoring id (`EnemyData.id`). */
export type EnemySpawnWeights = Record<string, number>;

export interface DirectedSpawnDecision {
  enemyId: string;
  elite: boolean;
}

const MINUTES_TO_MS = 60_000;

interface WaveBand {
  untilMinute: number;
  weights: EnemySpawnWeights;
  eliteChance: number;
}

const WAVE_BANDS: WaveBand[] = [
  {
    untilMinute: 1,
    weights: { bat: 1 },
    eliteChance: 0,
  },
  {
    untilMinute: 2,
    weights: { bat: 0.8, skeleton: 0.2 },
    eliteChance: 0,
  },
  {
    untilMinute: 3,
    weights: { bat: 0.55, skeleton: 0.45 },
    eliteChance: 0,
  },
  {
    untilMinute: 4,
    weights: { skeleton: 0.65, mudman: 0.25, bat: 0.1 },
    eliteChance: 0.01,
  },
  {
    untilMinute: 5,
    weights: { skeleton: 0.25, mudman: 0.5, mummy: 0.25 },
    eliteChance: 0.02,
  },
  {
    untilMinute: 6,
    weights: { mudman: 0.45, mummy: 0.35, skeleton: 0.1, mantis: 0.1 },
    eliteChance: 0.03,
  },
  {
    untilMinute: 7,
    weights: { bat: 0.15, skeleton: 0.05, mudman: 0.3, mummy: 0.3, mantis: 0.2 },
    eliteChance: 0.05,
  },
  {
    untilMinute: 8,
    weights: { skeleton: 0.1, mudman: 0.2, mummy: 0.3, mantis: 0.4 },
    eliteChance: 0.07,
  },
  {
    untilMinute: 9,
    weights: { mudman: 0.15, mummy: 0.25, mantis: 0.6 },
    eliteChance: 0.09,
  },
  {
    untilMinute: 10,
    weights: { mudman: 0.1, mummy: 0.2, mantis: 0.7 },
    eliteChance: 0.12,
  },
  {
    untilMinute: 12,
    weights: { mudman: 0.08, mummy: 0.15, mantis: 0.77 },
    eliteChance: 0.15,
  },
];

/**
 * Mirrors the Vampire Survivors minute wave table bundled with elite bias after 06:00.
 */
export function resolveDirectedSpawnDecision(
  elapsedMs: number,
  rngRandom: Pick<Math, "random">,
): DirectedSpawnDecision {
  const elapsedMinutes = elapsedMs / MINUTES_TO_MS;
  const band = selectWaveBand(elapsedMinutes);
  const table = band.weights;
  const enemyId = pickWeightedSpawn(table, rngRandom);
  const eliteChance = resolveEliteChance(elapsedMinutes, band.eliteChance);
  const eliteRoll = rngRandom.random() < eliteChance;

  return { enemyId, elite: eliteRoll };
}

function selectWaveBand(elapsedMinutes: number): WaveBand {
  for (const band of WAVE_BANDS) {
    if (elapsedMinutes < band.untilMinute) {
      return band;
    }
  }

  return {
    untilMinute: Number.POSITIVE_INFINITY,
    weights: { mudman: 0.05, mummy: 0.1, mantis: 0.85 },
    eliteChance: 0.18,
  };
}

function resolveEliteChance(elapsedMinutes: number, baseChance: number): number {
  if (elapsedMinutes < 6) {
    return 0;
  }

  const rampMinutes = Math.max(0, elapsedMinutes - 6);
  const ramped = baseChance + Math.min(rampMinutes, 8) * 0.015;
  return Math.min(ramped, 0.28);
}

function pickWeightedSpawn(weights: EnemySpawnWeights, rng: Pick<Math, "random">): string {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0 || entries.length === 0) {
    return "bat";
  }

  let cursor = rng.random() * totalWeight;
  for (const [spawnId, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) {
      return spawnId;
    }
  }

  return entries[entries.length - 1]?.[0] ?? "bat";
}
