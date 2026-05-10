function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Formats a run duration as `Xm Ys` for menus and post-run screens.
 */
export function formatRunDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${pad2(secs)}s`;
}
