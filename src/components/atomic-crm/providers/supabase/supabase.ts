import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { getClerk } from "../../auth/clerk";
import { config } from "../../root/config";

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(
      config.supabaseUrl!,
      config.supabasePublishableKey!,
      {
        // Supabase trusts Clerk as a third-party auth provider (see
        // supabase/config.toml). Read per request so the token is always fresh,
        // and fall back to anonymous when there is no Clerk session yet.
        accessToken: async () =>
          (await getClerk()?.session?.getToken()) ?? null,
      },
    );
  }
  return supabaseClient;
};
