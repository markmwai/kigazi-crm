import { ClerkLoaded, ClerkProvider } from "@clerk/clerk-react";

import { CRM } from "@/components/atomic-crm/root/CRM";
import { KigaziIdentityProvider } from "@/components/atomic-crm/auth/ClerkIdentity";
import { config } from "@/components/atomic-crm/root/config";
import {
  KIGAZI_SIGN_IN_URL,
  KIGAZI_SIGN_UP_URL,
  getAuthRedirectUrl,
} from "@/components/atomic-crm/auth/clerk";

/**
 * Application entry point
 *
 * Authentication is centralised on kigazi.com: Clerk issues the session here too
 * (satellite of the same Clerk instance) and Supabase trusts its tokens. Without
 * a publishable key the app renders unauthenticated, which is only useful for
 * the FakeRest demo (demo/App.tsx has its own entry point).
 *
 * Branding and CRM domain configuration live in
 * src/components/atomic-crm/root/defaultConfiguration.ts.
 */
const publishableKey = config.clerkPublishableKey;

const App = () =>
  publishableKey ? (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl={KIGAZI_SIGN_IN_URL}
      signUpUrl={KIGAZI_SIGN_UP_URL}
      signInFallbackRedirectUrl={getAuthRedirectUrl()}
      signUpFallbackRedirectUrl={getAuthRedirectUrl()}
      afterSignOutUrl={KIGAZI_SIGN_IN_URL}
    >
      <ClerkLoaded>
        <KigaziIdentityProvider>
          <CRM />
        </KigaziIdentityProvider>
      </ClerkLoaded>
    </ClerkProvider>
  ) : (
    <CRM />
  );

export default App;
