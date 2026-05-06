/**
 * ScoreSystem — computes a live score from kills, survival time, and level.
 *
 * Persistence now lives behind `platform/leaderboard/LeaderboardStore` so the
 * game logic no longer talks to `localStorage` directly.
 */

import {
  loadLeaderboard,
  saveLeaderboardEntry,
  seedLeaderboardEntries,
  type LeaderboardEntry,
} from "../platform/leaderboard/LeaderboardStore";

export type { LeaderboardEntry } from "../platform/leaderboard/LeaderboardStore";

// ─── Score calculation weights ─────────────────────────────────────────────
// Each kill:    +100 pts  (modified by enemy tier multiplier in future)
// Each second:  +10 pts  (survival bonus)
// Level-up:     +500 pts bonus on death for each level reached
const SCORE_PER_KILL = 100;
const SCORE_PER_SECOND = 10;
const SCORE_PER_LEVEL = 500;

export class ScoreSystem {
  private killCount = 0;
  private survivedMs = 0;

  // ─── Live score ─────────────────────────────────────────────────────────

  /** Call once per killed enemy to increment score. */
  registerKill(): void {
    this.killCount += 1;
  }

  /** Call each game tick with the delta time while the sim is active. */
  tick(dtMs: number): void {
    this.survivedMs += dtMs;
  }

  /** Returns the live rolling score for HUD display. */
  getLiveScore(survivorLevel: number): number {
    const killPts = this.killCount * SCORE_PER_KILL;
    const timePts = Math.floor((this.survivedMs / 1000) * SCORE_PER_SECOND);
    const levelPts = Math.max(0, survivorLevel - 1) * SCORE_PER_LEVEL;
    return killPts + timePts + levelPts;
  }

  getKillCount(): number {
    return this.killCount;
  }

  getSurvivedMs(): number {
    return this.survivedMs;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  /** Saves the final run through the leaderboard store and returns the score. */
  saveRun(wallet: string, survivorLevel: number): number {
    const score = this.getLiveScore(survivorLevel);

    const entry: LeaderboardEntry = {
      wallet,
      score,
      kills: this.killCount,
      level: survivorLevel,
      survivedMs: this.survivedMs,
      timestamp: Date.now(),
    };

    return saveLeaderboardEntry(entry);
  }

  // ─── Static helpers ───────────────────────────────────────────────────────

  static loadBoard(): LeaderboardEntry[] {
    return loadLeaderboard();
  }

  /**
   * Placeholder leaderboard data shown before any real runs are recorded.
   * These are not persisted, so real scores will replace them as players
   * complete runs.
   */
  static seedPlaceholders(): LeaderboardEntry[] {
    return seedLeaderboardEntries();
  }
}
