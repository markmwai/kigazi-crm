import { createContext, useContext } from "react";
import type { AppCatalogEntry } from "@/lib/apps";

export interface KigaziIdentity {
  apps: AppCatalogEntry[];
  organizationName: string | null;
  enabledAppIds: string[];
  signOut: () => void;
}

/** Null when Clerk is not configured (demo build). */
export const KigaziIdentityContext = createContext<KigaziIdentity | null>(null);

export function useKigaziIdentity(): KigaziIdentity | null {
  return useContext(KigaziIdentityContext);
}
