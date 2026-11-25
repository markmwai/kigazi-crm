// Pure mapping from Clerk webhook events to public.sales rows. No Deno imports,
// so it also runs under the Node `functions` test project.

export type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

export type ClerkWebhookEvent = {
  type: string;
  data: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: ClerkEmailAddress[];
    role?: string;
    public_user_data?: { user_id?: string };
  };
};

export type SaleUserRow = {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
};

export type SaleAdminUpdate = { user_id: string; administrator: boolean };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rows still keyed by a Supabase Auth uuid, i.e. users not migrated to Clerk. */
export const isUuid = (value: string) => UUID_RE.test(value);

export const getPrimaryEmail = (data: ClerkWebhookEvent["data"]) => {
  const addresses = data.email_addresses ?? [];
  const primary = addresses.find(
    (address) => address.id === data.primary_email_address_id,
  );
  const email = (primary ?? addresses[0])?.email_address;
  return email ? email.toLowerCase() : undefined;
};

/** user.created / user.updated → the row to upsert. */
export const toUserRow = (
  event: ClerkWebhookEvent,
): SaleUserRow | undefined => {
  if (event.type !== "user.created" && event.type !== "user.updated") {
    return undefined;
  }

  const user_id = event.data.id;
  const email = getPrimaryEmail(event.data);
  if (!user_id || !email) {
    return undefined;
  }

  // Undefined names are omitted on insert (the column defaults to 'Pending')
  // and left untouched on update.
  return {
    user_id,
    email,
    first_name: event.data.first_name ?? undefined,
    last_name: event.data.last_name ?? undefined,
  };
};

/**
 * organizationMembership.* → the administrator flag. A Clerk user object carries
 * no organization, so membership events are the only reliable source for
 * `org:admin`.
 *
 * shortcut: mirrors the latest membership event, which assumes one organization
 * per CRM user; a user in several orgs would flip with their last event.
 */
export const toAdminUpdate = (
  event: ClerkWebhookEvent,
): SaleAdminUpdate | undefined => {
  if (!event.type.startsWith("organizationMembership.")) {
    return undefined;
  }

  const user_id = event.data.public_user_data?.user_id;
  if (!user_id) {
    return undefined;
  }

  if (event.type === "organizationMembership.deleted") {
    return { user_id, administrator: false };
  }

  return { user_id, administrator: event.data.role === "org:admin" };
};
