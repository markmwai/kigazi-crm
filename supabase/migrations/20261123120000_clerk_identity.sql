-- Kigazi: Clerk is the identity provider for humans. Clerk user ids
-- (user_2abc...) are opaque strings, not uuids, so sales.user_id becomes text
-- and stops referencing auth.users. Native Supabase tokens (kept for MCP) also
-- carry the end-user id in the "sub" claim, so one helper serves both issuers.

alter table "public"."sales" drop constraint "sales_user_id_fkey";

alter table "public"."sales" alter column "user_id" set data type text;

CREATE OR REPLACE FUNCTION "public"."current_user_id"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
begin
  -- Both issuers put the end-user id in "sub": the Clerk user id (user_2abc...)
  -- for humans, and the Supabase Auth user id for MCP. auth.uid() is not used
  -- because it casts "sub" to uuid, which Clerk ids are not.
  return nullif(auth.jwt() ->> 'sub', '');
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  sales_count int;
begin
  select count(id) into sales_count
  from public.sales;

  delete from public.user_invitations where user_id = new.id;
  if sales_count > 0 and not found and not new.is_sso_user then
    raise exception 'Sign up is not allowed';
  end if;

  insert into public.sales (first_name, last_name, email, user_id, administrator)
  values (
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    new.email,
    new.id::text,
    case when sales_count > 0 then FALSE else TRUE end
  );
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_update_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.sales
  set
    first_name = coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    last_name = coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    email = new.email
  where user_id = new.id::text;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- Clerk: the organization role travels in the session token.
  if (auth.jwt() ->> 'org_role') = 'org:admin' then
    return true;
  end if;

  -- Native Supabase tokens (MCP) have no org claim; fall back to the sale row.
  return exists (
    select 1 from public.sales
    where user_id = public.current_user_id() and administrator = true
  );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."set_sales_id_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.sales_id IS NULL THEN
    SELECT id INTO NEW.sales_id FROM sales WHERE user_id = public.current_user_id();
  END IF;
  RETURN NEW;
END;
$$;

grant all on function public.current_user_id() to anon;
grant all on function public.current_user_id() to authenticated;
grant all on function public.current_user_id() to service_role;
