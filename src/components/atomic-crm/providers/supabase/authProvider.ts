import type { AuthProvider } from "ra-core";

import { getClerk, getSignInUrl } from "../../auth/clerk";
import { canAccess } from "../commons/canAccess";
import { getSupabaseClient } from "./supabase";

// Clerk owns the session; Supabase only stores the CRM records. Identity comes
// from the Clerk user id stored in sales.user_id (see current_user_id()).

// To speed up checks, we cache the initialization state in the local storage.
// It is cleared on logout.
const IS_INITIALIZED_CACHE_KEY = "RaStore.auth.is_initialized";

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export async function getIsInitialized() {
  const storage = getLocalStorage();
  const cachedValue = storage?.getItem(IS_INITIALIZED_CACHE_KEY);
  if (cachedValue != null) {
    return cachedValue === "true";
  }

  const { data } = await getSupabaseClient()
    .from("init_state")
    .select("is_initialized");
  const isInitialized = data?.at(0)?.is_initialized > 0;

  if (isInitialized) {
    storage?.setItem(IS_INITIALIZED_CACHE_KEY, "true");
  }

  return isInitialized;
}

type Sale = {
  id: number;
  first_name: string;
  last_name: string;
  avatar?: { src?: string } | null;
  administrator: boolean;
};

/** The sale row the Clerk user maps to. Created by the provisioning webhook. */
const getSale = async (): Promise<Sale | undefined> => {
  const userId = getClerk()?.user?.id;
  if (!userId) return undefined;

  const { data, error } = await getSupabaseClient()
    .from("sales")
    .select("id, first_name, last_name, avatar, administrator")
    .eq("user_id", userId)
    .maybeSingle<Sale>();

  if (error || data == null) {
    return undefined;
  }
  return data;
};

export const getAuthProvider = (): AuthProvider => ({
  login: async () => {
    window.location.assign(getSignInUrl());
  },
  logout: async () => {
    getLocalStorage()?.removeItem(IS_INITIALIZED_CACHE_KEY);
    await getClerk()?.signOut();
  },
  checkAuth: async () => {
    if (!getClerk()?.user) {
      throw { redirectTo: "/login", message: false };
    }
  },
  checkError: async (error) => {
    const status = error?.status;
    if (status === 401 || status === 403) {
      throw error;
    }
  },
  getIdentity: async () => {
    const sale = await getSale();
    if (sale) {
      return {
        id: sale.id,
        fullName: `${sale.first_name} ${sale.last_name}`,
        avatar: sale.avatar?.src,
      };
    }

    // Until the provisioning webhook has created the sale row, fall back to
    // Clerk so the app still renders.
    const user = getClerk()?.user;
    if (!user) {
      throw new Error("Not authenticated");
    }
    return {
      id: user.id,
      fullName: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "",
      avatar: user.imageUrl,
    };
  },
  canAccess: async (params) => {
    // Admins are driven by the Clerk organization role (decision #4), with the
    // sales row kept as the fallback for native Supabase tokens (MCP).
    const sale = await getSale();
    const role =
      getClerk()?.organization?.membership?.role === "org:admin" ||
      sale?.administrator
        ? "admin"
        : "user";
    return canAccess(role, params);
  },
  // MCP keeps using Supabase Auth as a second issuer (see the Phase 1 notes).
  getAuthorizationDetails(authorizationId: string) {
    return getSupabaseClient().auth.oauth.getAuthorizationDetails(
      authorizationId,
    );
  },
  approveAuthorization(authorizationId: string) {
    return getSupabaseClient().auth.oauth.approveAuthorization(authorizationId);
  },
  denyAuthorization(authorizationId: string) {
    return getSupabaseClient().auth.oauth.denyAuthorization(authorizationId);
  },
});
