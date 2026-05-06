export interface LeaderboardEntry {
  wallet: string;
  score: number;
  kills: number;
  level: number;
  survivedMs: number;
  timestamp: number;
}

const LEADERBOARD_KEY = "ritual_leaderboard_v1";
const MAX_ENTRIES = 10;

/**
 * Browser storage adapter for leaderboard records.
 *
 * The first extraction pass keeps persistence isolated so the rest of the game
 * can depend on `loadLeaderboard` / `saveLeaderboardEntry` instead of `localStorage`.
 */
export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) {
      return seedLeaderboardEntries();
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return seedLeaderboardEntries();
    }

    return parsed as LeaderboardEntry[];
  } catch {
    return seedLeaderboardEntries();
  }
}

export function saveLeaderboardEntry(entry: LeaderboardEntry): number {
  const board = loadLeaderboard();
  board.push(entry);
  board.sort((a, b) => b.score - a.score);

  const trimmed = board.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage failures so a final run still resolves cleanly.
  }

  return entry.score;
}

export function seedLeaderboardEntries(): LeaderboardEntry[] {
  const now = Date.now();
  const placeholders: Array<[string, number, number, number, number]> = [
    ["0x1a2b3c...f9e", 98420, 920, 25, 58 * 60_000],
    ["0x9f3e44...77a", 87310, 812, 22, 51 * 60_000],
    ["0xdeadb3...bee", 76540, 740, 20, 44 * 60_000],
    ["0x4c1a9f...f2b", 65200, 620, 18, 38 * 60_000],
    ["0x8b3dc0...091", 54780, 510, 16, 32 * 60_000],
    ["0x22113a...33a", 43360, 415, 14, 26 * 60_000],
    ["0xa7c9d1...d4e", 31200, 305, 12, 18 * 60_000],
    ["0x5f8bee...11c", 22890, 218, 10, 13 * 60_000],
    ["0xe3a18b...b5f", 14500, 142, 8, 8 * 60_000],
    ["0x001299...99d", 8100, 78, 5, 4 * 60_000],
  ];

  return placeholders.map(([wallet, score, kills, level, survivedMs], i) => ({
    wallet,
    score,
    kills,
    level,
    survivedMs,
    timestamp: now - (i + 1) * 3_600_000,
  }));
}
