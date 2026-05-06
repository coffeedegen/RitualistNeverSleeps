const RUNES = [
  "ᚠ",
  "ᚢ",
  "ᚦ",
  "ᚨ",
  "ᚱ",
  "ᚲ",
  "ᚷ",
  "ᚹ",
  "ᚺ",
  "ᚾ",
  "ᛁ",
  "ᛃ",
  "ᛇ",
  "ᛈ",
  "ᛉ",
  "ᛊ",
  "ᛏ",
  "ᛒ",
  "ᛖ",
  "ᛗ",
  "ᛚ",
  "ᛜ",
  "ᛞ",
  "ᛟ",
];

const POSITIONS: Array<[number, number]> = [
  [5, 10],
  [15, 80],
  [80, 15],
  [90, 70],
  [50, 5],
  [30, 60],
  [70, 40],
  [10, 45],
  [88, 30],
  [55, 85],
];

export function buildRuneDecor(): string {
  return POSITIONS.map(([x, y], i) => `
      <span class="hp-rune" style="left:${x}%;top:${y}%;animation-delay:${i * 0.7}s">
        ${RUNES[i % RUNES.length]}
      </span>
    `).join("");
}

export function shortenAddress(addr: string): string {
  if (addr.length < 10) {
    return addr;
  }

  return `${addr.slice(0, 6)}....${addr.slice(-3)}`;
}
