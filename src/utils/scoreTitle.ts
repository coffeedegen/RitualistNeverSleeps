export interface ScoreTitleTier {
  title: string;
  minimumScore: number;
}

export const SCORE_TITLE_TIERS: ScoreTitleTier[] = [
  { title: "Initiate", minimumScore: 0 },
  { title: "Bitty", minimumScore: 50_000 },
  { title: "Ritty", minimumScore: 150_000 },
  { title: "Ritualist", minimumScore: 250_000 },
  { title: "Zealot", minimumScore: 500_000 },
  { title: "Radiant Ritualist", minimumScore: 1_000_000 },
];

export function getScoreTitle(score: number): ScoreTitleTier {
  const normalizedScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  let current = SCORE_TITLE_TIERS[0] ?? { title: "Initiate", minimumScore: 0 };

  for (const tier of SCORE_TITLE_TIERS) {
    if (normalizedScore >= tier.minimumScore) {
      current = tier;
    }
  }

  return current;
}
