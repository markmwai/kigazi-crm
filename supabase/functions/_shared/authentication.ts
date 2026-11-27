// Based on https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/_shared/jwt/default.ts
import * as jose from "jsr:@panva/jose@6";
import { createClient, type User } from "jsr:@supabase/supabase-js@2";
import { createErrorResponse } from "./utils.ts";

const SUPABASE_JWT_ISSUER =
  Deno.env.get("SB_JWT_ISSUER") ?? Deno.env.get("SUPABASE_URL") + "/auth/v1";

const SUPABASE_JWT_KEYS = jose.createRemoteJWKSet(
  new URL(Deno.env.get("SUPABASE_URL")! + "/auth/v1/.well-known/jwks.json"),
);

// Clerk issues the human session tokens. Set CLERK_JWT_ISSUER (e.g.
// https://clerk.kigazi.com) or Clerk tokens are rejected.
const CLERK_JWT_ISSUER = Deno.env.get("CLERK_JWT_ISSUER")?.replace(/\/$/, "");

const CLERK_JWT_KEYS = CLERK_JWT_ISSUER
  ? jose.createRemoteJWKSet(
      new URL(`${CLERK_JWT_ISSUER}/.well-known/jwks.json`),
    )
  : null;

function getAuthToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer") {
    throw new Error(`Auth header is not 'Bearer {token}'`);
  }

  return token;
}

function verifySupabaseJWT(jwt: string) {
  return jose.jwtVerify(jwt, SUPABASE_JWT_KEYS, {
    issuer: SUPABASE_JWT_ISSUER,
  });
}

export type CallerIdentity = {
  userId: string;
  /** The active Clerk organization, from the token's "o".id claim. */
  organizationId?: string;
  claims: jose.JWTPayload;
};

/**
 * Verifies a Supabase Auth or Clerk session token and returns the caller.
 * Login-less providers (MCP) authenticate with Supabase tokens, which carry no
 * organization; callers decide whether an organization is required.
 */
export const verifyCaller = async (req: Request): Promise<CallerIdentity> => {
  const token = getAuthToken(req);
  const isClerk =
    CLERK_JWT_KEYS !== null && jose.decodeJwt(token).iss === CLERK_JWT_ISSUER;

  const { payload } = isClerk
    ? await jose.jwtVerify(token, CLERK_JWT_KEYS!, {
        issuer: CLERK_JWT_ISSUER!,
      })
    : await verifySupabaseJWT(token);

  if (!payload.sub) {
    throw new Error("JWT has no subject");
  }

  const organizationId = (payload.o as { id?: string } | undefined)?.id;

  return { userId: payload.sub, organizationId, claims: payload };
};

/**
 * Validates the Authorization header to ensure that a user is authenticated.
 */
export const AuthMiddleware = async (
  req: Request,
  next: (req: Request) => Promise<Response>,
) => {
  if (req.method === "OPTIONS") return await next(req);

  try {
    const token = getAuthToken(req);
    const isValidJWT = await verifySupabaseJWT(token);

    if (isValidJWT) return await next(req);

    return createErrorResponse(401, "Invalid authentication");
  } catch (e) {
    return createErrorResponse(401, e?.toString() || "Unauthorized");
  }
};

/**
 * Get the authenticated user using the authorization header.
 * User will be undefined for OPTIONS requests.
 */
export const UserMiddleware = async (
  req: Request,
  next: (req: Request, user?: User) => Promise<Response>,
) => {
  if (req.method === "OPTIONS") return await next(req);

  try {
    const authHeader = req.headers.get("Authorization")!;
    const localClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SB_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data, error: authError } = await localClient.auth.getUser();
    if (!data?.user || authError) {
      return createErrorResponse(401, "Unauthorized");
    }

    return next(req, data.user);
  } catch (err) {
    return createErrorResponse(401, err?.toString() || "Unauthorized");
  }
};
