import catalog from "./apps.json";

export interface AppCatalogEntry {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
}

// TODO: replace with the billing / plan-change route once Paystack entitlements exist.
export const ADD_TO_PLAN_URL =
  "mailto:sales@kigazi.com?subject=Add%20a%20Kigazi%20app%20to%20my%20plan";

function isCatalogEntry(value: unknown): value is AppCatalogEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.url === "string" &&
    typeof entry.icon === "string" &&
    typeof entry.description === "string"
  );
}

/**
 * Bundled copy of `https://kigazi.com/apps.json` so the switcher never depends
 * on a cross-origin fetch. The remote file is still fetched for live updates.
 */
export const FALLBACK_APPS: AppCatalogEntry[] = (catalog as unknown[]).filter(
  isCatalogEntry,
);

const CATALOG_URL = "https://kigazi.com/apps.json";

export async function loadApps(): Promise<AppCatalogEntry[]> {
  try {
    const response = await fetch(CATALOG_URL, { cache: "no-cache" });
    if (!response.ok) return FALLBACK_APPS;
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return FALLBACK_APPS;
    const apps = data.filter(isCatalogEntry);
    return apps.length > 0 ? apps : FALLBACK_APPS;
  } catch {
    return FALLBACK_APPS;
  }
}

/**
 * Entitlements v1 live in Clerk organization public metadata.
 * Missing or invalid metadata means "all customer apps enabled"; a valid array
 * (including an empty one) is honoured literally. The hub entry is never an
 * entitlement.
 */
export function enabledAppIds(metadata: unknown): string[] {
  const apps = (metadata as { apps?: unknown } | null | undefined)?.apps;
  if (Array.isArray(apps)) {
    return apps.filter((app): app is string => typeof app === "string");
  }
  return FALLBACK_APPS.filter((app) => app.id !== "home").map((app) => app.id);
}

/** Hub URL that lets the user select an agency, then returns to this app. */
export function noOrgRedirectUrl(currentUrl: string): string {
  return `https://kigazi.com/home?reason=select-org&redirect_url=${encodeURIComponent(currentUrl)}`;
}
