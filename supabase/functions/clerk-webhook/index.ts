// Clerk → public.sales provisioning. Clerk is the identity provider, so users
// have no auth.users row; this webhook is what creates their CRM profile.
//
// Deployed with verify_jwt = false (see supabase/config.toml): Clerk signs the
// request with Svix instead, and that signature is verified below.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "npm:svix@1";

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  toAdminUpdate,
  toUserRow,
  type ClerkWebhookEvent,
} from "./clerkWebhook.ts";

const webhookSecret = Deno.env.get("CLERK_WEBHOOK_SECRET");
if (!webhookSecret) {
  throw new Error("Missing CLERK_WEBHOOK_SECRET env variable");
}

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method not allowed");
  }

  // Read the body once: the signature is computed over the raw payload.
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ClerkWebhookEvent;
  try {
    event = new Webhook(webhookSecret).verify(
      payload,
      headers,
    ) as ClerkWebhookEvent;
  } catch (error) {
    return createErrorResponse(400, `Invalid webhook signature: ${error}`);
  }

  const userRow = toUserRow(event);
  if (userRow) {
    const { data: existing } = await supabaseAdmin
      .from("sales")
      .select("administrator")
      .eq("user_id", userRow.user_id)
      .maybeSingle();

    // Keep an existing admin flag, so a profile update never demotes anyone.
    let administrator = existing?.administrator ?? false;
    if (existing == null) {
      // The first user bootstraps the CRM as admin. Two signups landing in the
      // same instant can both win; harmless, since is_admin() trusts the Clerk
      // org role first and this flag is only the MCP fallback.
      const { count } = await supabaseAdmin
        .from("sales")
        .select("id", { count: "exact", head: true });
      administrator = (count ?? 0) === 0;
    }

    const { error } = await supabaseAdmin
      .from("sales")
      .upsert({ ...userRow, administrator }, { onConflict: "user_id" });

    if (error) {
      return createErrorResponse(500, error.message);
    }
    return ok({ ok: true, event: event.type });
  }

  const adminUpdate = toAdminUpdate(event);
  if (adminUpdate) {
    // Update only: if the user.created event has not landed yet there is no
    // row to flag, and creating one would need the email we do not have here.
    const { error } = await supabaseAdmin
      .from("sales")
      .update({ administrator: adminUpdate.administrator })
      .eq("user_id", adminUpdate.user_id);

    if (error) {
      return createErrorResponse(500, error.message);
    }
    return ok({ ok: true, event: event.type });
  }

  // Anything else (user.deleted, session.*, ...) is acknowledged and ignored.
  return ok({ ok: true, ignored: event.type });
});
