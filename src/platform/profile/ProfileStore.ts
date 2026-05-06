export interface PlayerProfile {
  xHandle: string | null;
}

const PROFILE_KEY = "ritual_profile_v1";

export function normalizeXHandle(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim().replace(/^@+/, "");
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.replace(/\s+/g, "");
}

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return { xHandle: null };
    }

    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      xHandle: normalizeXHandle(parsed.xHandle ?? null),
    };
  } catch {
    return { xHandle: null };
  }
}

export function savePlayerProfile(profile: PlayerProfile): PlayerProfile {
  const cleaned: PlayerProfile = {
    xHandle: normalizeXHandle(profile.xHandle),
  };

  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(cleaned));
  } catch {
    // Non-fatal: the current session can still use the profile in-memory.
  }

  return cleaned;
}

export function clearPlayerProfile(): void {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Ignore storage failures during teardown.
  }
}

export function buildXAvatarUrl(handle: string | null | undefined): string | null {
  const cleaned = normalizeXHandle(handle);
  if (!cleaned) {
    return null;
  }

  return `https://unavatar.io/x/${encodeURIComponent(cleaned)}`;
}

export function resolveDisplayName(
  walletAddress: string | null | undefined,
  xHandle: string | null | undefined,
): string {
  const cleaned = normalizeXHandle(xHandle);
  if (cleaned) {
    return `@${cleaned}`;
  }

  if (walletAddress && walletAddress.length >= 10) {
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }

  return "Unlinked";
}
