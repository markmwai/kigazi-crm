/**
 * The CRM is a satellite of the Kigazi central auth hub (kigazi.com): Clerk
 * owns sign-in, sign-up, and organizations, and Supabase only verifies the
 * Clerk session token (see supabase/config.toml, third-party auth).
 */

export const KIGAZI_SIGN_IN_URL = "https://kigazi.com/sign-in";
export const KIGAZI_SIGN_UP_URL = "https://kigazi.com/sign-up";

/** Minimal shape of the instance ClerkProvider publishes on window.Clerk. */
export type ClerkInstance = {
  user?: {
    id: string;
    fullName?: string | null;
    primaryEmailAddress?: { emailAddress: string } | null;
    imageUrl?: string;
  } | null;
  session?: { getToken: () => Promise<string | null> } | null;
  organization?: { membership?: { role: string } | null } | null;
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
export const getAuthRedirectUrl = () => window.location.origin;

export const getSignInUrl = () =>
  `${KIGAZI_SIGN_IN_URL}?redirect_url=${encodeURIComponent(getAuthRedirectUrl())}`;

export const getSignUpUrl = () =>
  `${KIGAZI_SIGN_UP_URL}?redirect_url=${encodeURIComponent(getAuthRedirectUrl())}`;
