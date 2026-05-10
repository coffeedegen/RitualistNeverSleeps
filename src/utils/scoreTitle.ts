export interface ScoreTitleTier {
  title: string;
  minimumScore: number;
  color: string;
}

export const SCORE_TITLE_TIERS: ScoreTitleTier[] = [
  { title: "Initiate", minimumScore: 0, color: "Brown" },
  { title: "Bitty", minimumScore: 25_000, color: "Blue" },
  { title: "Ritty", minimumScore: 75_000, color: "Purple" },
  { title: "Ritualist", minimumScore: 125_000, color: "Green" },
  { title: "Zealot", minimumScore: 175_000, color: "Indigo" },
  { title: "Radiant Ritualist", minimumScore: 250_000, color: "Gold" },
];

const DEFAULT_SCORE_TIER: ScoreTitleTier = SCORE_TITLE_TIERS[0] ?? {
  title: "Initiate",
  minimumScore: 0,
  color: "Brown",
};

export function getScoreTier(score: number): ScoreTitleTier {
  const normalizedScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  let current = DEFAULT_SCORE_TIER;

  for (const tier of SCORE_TITLE_TIERS) {
    if (normalizedScore >= tier.minimumScore) {
      current = tier;
    }
  }

  return current;
}

export function getScoreTitle(score: number): ScoreTitleTier {
  return getScoreTier(score);
}
