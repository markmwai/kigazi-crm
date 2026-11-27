const COOKIE_NAME = "kz_last";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface LastUsed {
  userId: string;
  appId: string;
  at: number;
}

function isKigaziHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "kigazi.com" || host.endsWith(".kigazi.com");
}

/** Reads the shared cookie without checking which user wrote it. */
export function readLastUsed(): LastUsed | null {
  if (typeof document === "undefined") return null;
  try {
    const raw = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!raw) return null;

    const value = decodeURIComponent(raw.slice(COOKIE_NAME.length + 1));
    const [userId, appId, seconds] = value.split(":");
    if (!userId || !appId || !seconds) return null;

    const at = Number(seconds);
    if (!Number.isFinite(at) || at <= 0) return null;
    return { userId, appId, at };
  } catch {
    return null;
  }
}

/**
 * Records an app for the hub's "Last used" strip.
 * Format: `<clerkUserId>:<appId>:<unixSeconds>` on `.kigazi.com`.
 * Silently does nothing on localhost/dev, where that cookie cannot be set.
 */
export function writeLastUsed(userId: string, appId: string): void {
  if (!userId || !appId || !isKigaziHost()) return;
  try {
    const value = `${userId}:${appId}:${Math.floor(Date.now() / 1000)}`;
    document.cookie = `${COOKIE_NAME}=${value}; Domain=.kigazi.com; Path=/; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
  } catch {
    // Localhost and non-.kigazi.com hosts cannot set this cookie.
  }
}

/**
 * Rewrites the cookie for a new app before navigation, preserving the user id
 * already stored by the host app. No cookie yet (first visit) is a no-op; the
 * destination app writes one on mount.
 */
export function recordLastUsed(appId: string): void {
  if (!appId) return;
  const current = readLastUsed();
  if (current) writeLastUsed(current.userId, appId);
}
