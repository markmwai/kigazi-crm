import { useEffect, useState, type ReactNode } from "react";
import { useAuth, useOrganization, useUser } from "@clerk/clerk-react";
import {
  FALLBACK_APPS,
  enabledAppIds,
  loadApps,
  noOrgRedirectUrl,
  type AppCatalogEntry,
} from "@/lib/apps";
import { writeLastUsed } from "@/lib/last-used";
import { KigaziIdentityContext, type KigaziIdentity } from "./kigazi-identity";

/**
 * Clerk-aware bridge rendered only inside <ClerkProvider> (see src/App.tsx).
 *
 * The demo build has no ClerkProvider, so Clerk hooks must live here rather
 * than in the layouts: consumers read the context and get null in demo mode.
 */
export function KigaziIdentityProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const [apps, setApps] = useState<AppCatalogEntry[]>(FALLBACK_APPS);

  useEffect(() => {
    let alive = true;
    loadApps().then((catalog) => {
      if (alive) setApps(catalog);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Record this app for the hub's "Last used" strip (once per user).
  useEffect(() => {
    if (user?.id) writeLastUsed(user.id, "crm");
  }, [user?.id]);

  // No active organization: the hub owns agency selection.
  useEffect(() => {
    if (isLoaded && orgLoaded && isSignedIn && !organization) {
      window.location.replace(noOrgRedirectUrl(window.location.href));
    }
  }, [isLoaded, orgLoaded, isSignedIn, organization]);

  const value: KigaziIdentity = {
    apps,
    enabledAppIds: enabledAppIds(organization?.publicMetadata),
  };

  return (
    <KigaziIdentityContext.Provider value={value}>
      {children}
    </KigaziIdentityContext.Provider>
  );
}
