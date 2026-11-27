/**
 * Clerk owns sign-in, sign-up, and organizations for the Kigazi ecosystem.
 * kigazi.com and its product subdomains share one root domain, so Clerk shares
 * the session (and active organization) across them by default — no satellite
 * domain configuration is involved. Supabase only verifies the Clerk session
 * token (see supabase/config.toml, third-party auth).
 */

export const KIGAZI_SIGN_IN_URL = "https://kigazi.com/sign-in";
export const KIGAZI_SIGN_UP_URL = "https://kigazi.com/sign-up";

// Production is served from the root of crm.kigazi.com on Cloudflare Pages;
// the dev server runs on localhost. `vite build` sets DEV to false.
const PRODUCTION_URL = "https://crm.kigazi.com";
const DEVELOPMENT_URL = "http://localhost:5173";

/** Minimal shape of the instance ClerkProvider publishes on window.Clerk. */
export type ClerkInstance = {
  user?: {
    id: string;
    fullName?: string | null;
    primaryEmailAddress?: { emailAddress: string } | null;
    imageUrl?: string;
  } | null;
  session?: { getToken: () => Promise<string | null> } | null;
  organization?: {
    id: string;
    membership?: { role: string } | null;
  } | null;
  signOut: () => Promise<void>;
  openOrganizationProfile: (props?: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    Clerk?: ClerkInstance;
  }
}

// <ClerkProvider> assigns window.Clerk once the SDK has loaded.
export const getClerk = () => window.Clerk;

/** Clerk sends the browser back here after the central sign-in. */
export const getAuthRedirectUrl = () =>
  import.meta.env.DEV ? DEVELOPMENT_URL : PRODUCTION_URL;

export const getSignInUrl = () =>
  `${KIGAZI_SIGN_IN_URL}?redirect_url=${encodeURIComponent(getAuthRedirectUrl())}`;

export const getSignUpUrl = () =>
  `${KIGAZI_SIGN_UP_URL}?redirect_url=${encodeURIComponent(getAuthRedirectUrl())}`;
