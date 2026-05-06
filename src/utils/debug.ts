/**
 * Development-only logging. No output in production builds.
 */
export const Debug = {
  /**
   * Logs a message when `import.meta.env.DEV` is true.
   * @param args Values to forward to `console.log`.
   */
  log(...args: unknown[]): void {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
} as const;
