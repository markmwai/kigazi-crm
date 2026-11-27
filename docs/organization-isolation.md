# Organization isolation

The CRM is multi-tenant. Every tenant-owned row belongs to one Clerk
organization, and PostgreSQL Row Level Security (RLS) is the security boundary.
Client-side filters only make intent explicit; they are never trusted.

## Tenant model

- Clerk owns identity and organizations. The active organization travels in the
  session token under `o.id` (e.g. `{"o":{"id":"org_2abc..."}}`).
- `public.current_organization_id()` reads that claim:
  `nullif(auth.jwt() -> 'o' ->> 'id', '')`.
- Supabase trusts Clerk through third-party auth. Supabase-native tokens (MCP)
  carry no `o` claim, so they see **no tenant data**. That is intentional.
- A signed-in user **without an active organization** sees no tenant data.
  Selecting a workspace in the header sets the active organization and reloads
  so the next token carries it.
- `organization_id text not null default ''` exists on the tenant tables. A
  `BEFORE INSERT` trigger (`set_organization_id_default`) stamps it from the
  JWT when the client omitted it, but never overwrites a supplied value — a
  mismatched value is rejected by the RLS `WITH CHECK`.

### Tables covered by RLS

`companies`, `contacts`, `contact_notes`, `deals`, `deal_notes`, `tags`,
`tasks`.

Each has four policies (select / insert / update / delete) to `authenticated`
requiring `organization_id = public.current_organization_id()`; update carries
both `USING` and `WITH CHECK`, so a row cannot be moved between organizations.

The views `contacts_summary`, `companies_summary` and `activity_log` are
`security_invoker = on`, so they inherit the table policies. `global_search()`
is `SECURITY INVOKER` and therefore also follows RLS.

## Cross-organization foreign keys

Scalar relationships use **composite foreign keys** so the child's organization
is part of the reference:

| Relationship | Constraint | Behavior |
| --- | --- | --- |
| `contacts.company_id` → `companies` | `contacts_company_organization_fkey (company_id, organization_id)` | reject cross-org |
| `deals.company_id` → `companies` | `deals_company_organization_fkey (company_id, organization_id)` | reject cross-org |
| `contact_notes.contact_id` → `contacts` | `contact_notes_contact_organization_fkey (contact_id, organization_id)` | reject cross-org |
| `deal_notes.deal_id` → `deals` | `deal_notes_deal_organization_fkey (deal_id, organization_id)` | reject cross-org |
| `tasks.contact_id` → `contacts` | `tasks_contact_organization_fkey (contact_id, organization_id)` | reject cross-org |

They reference `unique (id, organization_id)` on `companies`, `contacts` and
`deals`. Inserts and updates are both covered; moving a child to a parent in
another organization fails at the constraint.

`tasks` has no `deal_id` or `company_id` column, so only the contact reference
applies.

Arrays cannot carry a foreign key, so read-only `SECURITY DEFINER` triggers
validate them:

- `contacts.tags` → `validate_contact_tag_organizations`: every tag id must
  exist in the contact's organization.
- `deals.contact_ids` → `validate_deal_contact_organizations`: every contact id
  must exist in the deal's organization.

Both run on insert and update, are `SECURITY DEFINER` (to see rows hidden by
RLS), and only read and reject. `sales_id` references the global `sales` table
and is not tenant-scoped.

## Storage (attachments)

Bucket: `attachments` (configurable with `VITE_ATTACHMENTS_BUCKET`).

### Path convention

New uploads are stored at `<organization_id>/<random>.<ext>`
(`uploadToBucket` in the Supabase data provider). The first path segment is the
tenant. Legacy objects at the bucket root cannot be attributed to a tenant.

### RLS on `storage.objects`

Four policies for `authenticated`, each requiring:

```sql
bucket_id = 'attachments'
and starts_with(name, public.current_organization_id() || '/')
```

This covers list (`select`), upload (`insert`), overwrite/move (`update`, with
`USING` and `WITH CHECK`) and delete. Signed-URL creation requires `select`, so
it is scoped too. Copy is an `insert` at the destination, so it is scoped.

The attachment cleanup Edge Function (`delete_note_attachments`, service role)
verifies the caller's JWT, requires an active organization, and only considers
paths under `<organization_id>/`; a caller cannot delete another tenant's file.

### Status: the bucket is still PUBLIC

Public object URLs (`/storage/v1/object/public/...`) bypass RLS, so **read
access is not tenant-isolated while the bucket is public**. Verified:

- protected now: upload, list, signed-URL creation, move, copy, delete (RLS).
- not protected now: public URL reads and authenticated GET reads.

Making the bucket private closes this. The cutover is prepared but **not
applied**: `supabase/pending-migrations/20261127170000_private_attachments_bucket.sql`
(kept outside `supabase/migrations` so `db push` cannot apply it by accident).

Impact of going private: the app stores public URLs in `attachments[].src`
(note attachments) and in `logo`/`avatar` fields (company logos, contact
avatars). Those URLs stop working. The safe cutover is:

1. Serve signed URLs at read time (a small resolver that takes `path` and calls
   `storage.createSignedUrl(path, …)`), for note attachments, contact avatars
   and company logos.
2. Backfill `src` (and `avatar.src`, `logo.src`) to the object path so the
   resolver has a stable key; existing `path` fields are already present.
3. Deploy the client, confirm attachments/logos/avatars render.
4. Apply the pending migration (`update storage.buckets set public = false`).
5. Rollback if needed: `update storage.buckets set public = true`.

Verified locally with the bucket private: Org A downloads its object (200), Org
B gets 404, the public URL is 404, and signed-URL creation for Org B is 404.

## Service-role and `SECURITY DEFINER` inventory

| Path | Bypass | Classification | Safeguard / recommendation |
| --- | --- | --- | --- |
| `merge_contacts` Edge Function | service-role DB connection + role switch | **tenant-safe (hardened)** | verifies JWT (Supabase or Clerk), requires an org, privileged pre-check of both contacts, transaction runs under RLS with the verified claims, explicit org filters on every statement |
| `delete_note_attachments` Edge Function | service role + `SECURITY DEFINER` trigger webhook | **tenant-safe (hardened)** | rejects missing org, verifies JWT, only deletes `org/<random>` paths belonging to the caller's org, only when unreferenced |
| `handle_contact_note_created_or_updated` trigger | `SECURITY DEFINER` | **tenant-safe (hardened)** | updates `last_seen` only when `contacts.organization_id = new.organization_id` |
| `validate_contact_tag_organizations` / `validate_deal_contact_organizations` triggers | `SECURITY DEFINER` | tenant-safe | read-only validation; rejects cross-org array entries |
| `cleanup_note_attachments` trigger | `SECURITY DEFINER` | tenant-safe | no row writes; forwards the caller's auth header to the hardened cleanup function. Fails closed when the header is a service-role token |
| `clerk-webhook` Edge Function | service role | intentionally global | provisions the global `sales` identity row |
| `users` Edge Function | service role | intentionally global (identity) / future work | manages `sales` + Supabase Auth users. `administrator` is the global flag, not `org_role`; an org admin cannot manage per-org users yet. Future: store the org on `sales` or a membership table and scope the function |
| `update_password` Edge Function | service role | tenant-safe | resolves the caller's own sale and resets that user only |
| `postmark` Edge Function | service role | **requires future work** | inbound email has no organization context. It writes notes with the matched contact's `organization_id` (so the composite FK holds), but a single inbound address cannot route to a specific org. Future: per-organization inbound addresses (store `organization_id` on `sales` or an inbound-address table) and scope contact/company lookups and attachment paths by it |
| `handle_new_user` / `handle_update_user` triggers | `SECURITY DEFINER` | intentionally global | mirror `auth.users` into the global `sales` table |
| `get_user_id_by_email` | `SECURITY DEFINER`, service role only | intentionally global | identity lookup used by `users` |
| `is_admin()` | `SECURITY DEFINER` | tenant-safe | reads the Clerk `org_role` claim, falls back to `sales.administrator` for native tokens |
| `merge_contacts` SQL RPC (legacy) | `SECURITY INVOKER` | tenant-safe | RLS applies to every statement |
| MCP (`functions/mcp`) | direct DB connection, sets claims + role | tenant-safe but limited | runs under RLS with the caller's token; native tokens carry no `o`, so MCP sees no tenant data until org claims are added |
| `extractAndUploadAttachments` (Postmark) | service role | **requires future work** | uploads legacy root paths (no org prefix), so the files are not reachable through tenant-scoped storage RLS. Future: prefix with the resolved organization path once inbound routing exists |

No cron jobs or scheduled functions are configured.

## Global resources

Two resources are deliberately global. Do **not** scope them without the
migration plan below.

### `sales`

- Current exposure: every authenticated user can read all sales rows (names,
  emails, avatars, `administrator`). It is the identity directory shared with
  Supabase Auth/MCP and is referenced by `*_sales_id` columns.
- Intended ownership: a sale will belong to one or more organizations, or a
  user will have one sale row plus organization memberships.
- Future migration: add a `sales_organizations (sales_id, organization_id)`
  join table, backfill from Clerk memberships (webhook), then replace the
  `sales` SELECT policy with a membership check. Keep `sales` rows global and
  never delete them. This also enables per-org admin checks.

### `configuration`

- Current exposure: every authenticated user can read the app-wide branding
  (title, logos, sectors, deal stages, task types); `is_admin()` (org admin or
  global flag) can update it, so an admin of one org can change branding seen
  by every org.
- Intended ownership: branding is either platform-wide (keep it admin-only at
  the platform level) or per organization.
- Future migration: add `organization_id` to `configuration` with one row per
  org (`unique (organization_id)`), read/write policies keyed to
  `current_organization_id()`, and read the row in `getConfiguration()` by
  active org with a fallback to platform defaults. The client store
  (`CRM.app.configuration`) must be keyed by organization.

## Backfill warning

Rows created before multi-tenancy have `organization_id = ''`. They are
**invisible to every organization** because no JWT carries an empty
organization. They do not leak; they disappear until backfilled.

```sql
-- Run per organization, after confirming which rows belong to it.
update public.companies    set organization_id = '<clerk_org_id>' where organization_id = '';
update public.contacts     set organization_id = '<clerk_org_id>' where organization_id = '';
update public.contact_notes set organization_id = '<clerk_org_id>' where organization_id = '';
update public.deals        set organization_id = '<clerk_org_id>' where organization_id = '';
update public.deal_notes   set organization_id = '<clerk_org_id>' where organization_id = '';
update public.tasks        set organization_id = '<clerk_org_id>' where organization_id = '';
update public.tags         set organization_id = '<clerk_org_id>' where organization_id = '';
```

Backfill parents before children so the composite foreign keys stay valid. The
cross-org pre-check (`contacts.company_id`, `deals.company_id`,
`contact_notes.contact_id`, `deal_notes.deal_id`, `tasks.contact_id`, plus the
`deals.contact_ids` and `contacts.tags` arrays) must return zero mismatches.

## Production rollout checklist

1. Back up the database.
2. Apply the migrations (see commands below).
3. Verify no cross-org mismatches (queries in the backfill section).
4. Sign in as two organizations and confirm: lists, creates, merges and
   attachments are isolated.
5. Confirm every Edge Function has `CLERK_JWT_ISSUER` set (needed by
   `merge_contacts` and `delete_note_attachments` for Clerk tokens).
6. Do **not** apply the private-bucket migration until the signed-URL client
   cutover is live.

Rollback of this hardening: drop the composite foreign keys and validation
triggers, recreate the original single-column foreign keys (definitions in
`supabase/schemas/01_tables.sql` history), and restore the previous storage
policies. The private-bucket change is a one-line rollback
(`update storage.buckets set public = true`).

## Exact production deployment commands (not executed here)

```sh
npx supabase db push
npx supabase secrets set CLERK_JWT_ISSUER=https://clerk.kigazi.com
npx supabase functions deploy merge_contacts
npx supabase functions deploy delete_note_attachments
npx supabase functions deploy postmark
npx supabase functions deploy users
```

The private attachments cutover is a separate, client-coordinated deployment;
see `supabase/pending-migrations/`.
