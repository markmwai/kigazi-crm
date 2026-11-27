-- Tenant isolation hardening: handle_contact_note_created_or_updated() is
-- SECURITY DEFINER, so it bypasses RLS. Scope its write to the note's
-- organization, otherwise a note in one tenant could touch another tenant's
-- contact (last_seen).

CREATE OR REPLACE FUNCTION "public"."handle_contact_note_created_or_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- SECURITY DEFINER bypasses RLS: only touch a contact from the same
  -- organization as the note, so a note cannot write to another tenant.
  update public.contacts
  set last_seen = new.date
  where contacts.id = new.contact_id
    and contacts.organization_id = new.organization_id
    and contacts.last_seen < new.date;
  return new;
end;
$$;
