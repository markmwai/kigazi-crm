import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sql, type Selectable } from "https://esm.sh/kysely@0.27.2";
import { db, type ContactsTable, CompiledQuery } from "../_shared/db.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  verifyCaller,
  type CallerIdentity,
} from "../_shared/authentication.ts";
import { authorizeMerge } from "./organization.ts";

type Contact = Selectable<ContactsTable>;

// Helper functions to merge arrays
function mergeArraysUnique<T>(arr1: T[], arr2: T[]): T[] {
  return [...new Set([...arr1, ...arr2])];
}

function mergeObjectArraysUnique<T>(
  arr1: T[],
  arr2: T[],
  getKey: (item: T) => string,
): T[] {
  const map = new Map<string, T>();

  arr1.forEach((item) => {
    const key = getKey(item);
    if (key) map.set(key, item);
  });

  arr2.forEach((item) => {
    const key = getKey(item);
    if (key && !map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
}

function mergeContactData(winner: Contact, loser: Contact) {
  // Merge emails
  const mergedEmails = mergeObjectArraysUnique(
    winner.email_jsonb || [],
    loser.email_jsonb || [],
    (email: any) => email.email,
  );

  // Merge phones
  const mergedPhones = mergeObjectArraysUnique(
    winner.phone_jsonb || [],
    loser.phone_jsonb || [],
    (phone: any) => phone.number,
  );

  const selectedAvatar =
    winner.avatar && winner.avatar.src ? winner.avatar : loser.avatar;

  return {
    avatar: selectedAvatar ? (JSON.stringify(selectedAvatar) as any) : null,
    gender: winner.gender ?? loser.gender,
    first_name: winner.first_name ?? loser.first_name,
    last_name: winner.last_name ?? loser.last_name,
    title: winner.title ?? loser.title,
    company_id: winner.company_id ?? loser.company_id,
    email_jsonb: JSON.stringify(mergedEmails) as any,
    phone_jsonb: JSON.stringify(mergedPhones) as any,
    linkedin_url: winner.linkedin_url || loser.linkedin_url,
    background: winner.background ?? loser.background,
    has_newsletter: winner.has_newsletter ?? loser.has_newsletter,
    first_seen: winner.first_seen ?? loser.first_seen,
    last_seen:
      winner.last_seen && loser.last_seen
        ? winner.last_seen > loser.last_seen
          ? winner.last_seen
          : loser.last_seen
        : (winner.last_seen ?? loser.last_seen),
    sales_id: winner.sales_id ?? loser.sales_id,
    tags: mergeArraysUnique(winner.tags || [], loser.tags || []),
  };
}

async function mergeContacts(
  loserId: number,
  winnerId: number,
  caller: CallerIdentity,
  organizationId: string,
) {
  try {
    return await db.transaction().execute(async (trx) => {
      // Run as the caller with their verified claims, so the RLS policies on
      // every statement below also enforce the organization.
      await trx.executeQuery(CompiledQuery.raw("SET LOCAL ROLE authenticated"));
      await sql`select set_config('request.jwt.claims', ${JSON.stringify(caller.claims)}, true)`.execute(
        trx,
      );

      // 1. Fetch both contacts
      const [winner, loser] = await Promise.all([
        trx
          .selectFrom("contacts")
          .selectAll()
          .where("id", "=", winnerId)
          .where("organization_id", "=", organizationId)
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("contacts")
          .selectAll()
          .where("id", "=", loserId)
          .where("organization_id", "=", organizationId)
          .executeTakeFirstOrThrow(),
      ]);

      // 2. Reassign tasks from loser to winner
      await trx
        .updateTable("tasks")
        .set({ contact_id: winnerId })
        .where("contact_id", "=", loserId)
        .where("organization_id", "=", organizationId)
        .execute();

      // 3. Reassign notes from loser to winner
      await trx
        .updateTable("contact_notes")
        .set({ contact_id: winnerId })
        .where("contact_id", "=", loserId)
        .where("organization_id", "=", organizationId)
        .execute();

      // 4. Update deals - replace loserId with winnerId in contact_ids array
      const deals = await trx
        .selectFrom("deals")
        .selectAll()
        .where(sql`contact_ids @> ARRAY[${loserId}]::bigint[]`)
        .where("organization_id", "=", organizationId)
        .execute();

      for (const deal of deals) {
        // bigint[] comes back as strings; normalize before comparing ids.
        const currentIds = (deal.contact_ids ?? []).map(Number);
        const newContactIds = [
          ...new Set(
            currentIds.filter((id) => id !== loserId).concat(winnerId),
          ),
        ];
        await trx
          .updateTable("deals")
          .set({ contact_ids: newContactIds })
          .where("id", "=", deal.id)
          .where("organization_id", "=", organizationId)
          .execute();
      }

      // 5. Merge and update winner contact
      const mergedData = mergeContactData(winner as Contact, loser as Contact);
      await trx
        .updateTable("contacts")
        .set(mergedData)
        .where("id", "=", winnerId)
        .where("organization_id", "=", organizationId)
        .execute();

      // 6. Delete loser contact
      await trx
        .deleteFrom("contacts")
        .where("id", "=", loserId)
        .where("organization_id", "=", organizationId)
        .execute();

      return { success: true, winnerId };
    });
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    let caller: CallerIdentity;
    try {
      caller = await verifyCaller(req);
    } catch {
      return createErrorResponse(401, "Invalid authentication");
    }

    const body = (await req.json().catch(() => ({}))) as {
      loserId?: number;
      winnerId?: number;
    };
    const loserId = Number(body.loserId);
    const winnerId = Number(body.winnerId);
    if (!Number.isInteger(loserId) || !Number.isInteger(winnerId)) {
      return createErrorResponse(400, "Missing loserId or winnerId");
    }

    try {
      // Privileged read: compare both rows' organizations before touching any
      // data, because the merge runs with the service-role connection.
      const contacts = await db
        .selectFrom("contacts")
        .select(["id", "organization_id"])
        .where("id", "in", [loserId, winnerId])
        .execute();

      const authorization = authorizeMerge(
        contacts,
        loserId,
        winnerId,
        caller.organizationId,
      );
      if (!authorization.allowed) {
        return createErrorResponse(authorization.status, authorization.message);
      }

      const result = await mergeContacts(
        loserId,
        winnerId,
        caller,
        authorization.organizationId,
      );

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error) {
      console.error("Merge failed:", error);
      return createErrorResponse(
        500,
        `Failed to merge contacts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }),
);
