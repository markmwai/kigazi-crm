const COOKIE_NAME = "kz_last";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function isKigaziHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "kigazi.com" || host.endsWith(".kigazi.com");
}

/**
 * Records the current app for the hub's "Last used" strip.
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
