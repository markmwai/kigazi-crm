// One-off: re-key sales rows that still use a Supabase Auth uuid to the Clerk
// user id with the same email. Dry run unless --apply is passed.
/* eslint-disable no-console */
//
//   node --env-file=.env scripts/backfill-clerk-users.mjs
//   node --env-file=.env scripts/backfill-clerk-users.mjs --apply
//
// Needs CLERK_SECRET_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the two
// Supabase values are printed by `npx supabase status`).

const CLERK_API = "https://api.clerk.com/v1";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APPLY = process.argv.includes("--apply");

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const primaryEmail = (user) => {
  const addresses = user.email_addresses ?? [];
  const primary =
    addresses.find((address) => address.id === user.primary_email_address_id) ??
    addresses[0];
  return primary?.email_address?.toLowerCase();
};

async function listClerkUsers(secretKey) {
  const byEmail = new Map();
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(
      `${CLERK_API}/users?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    if (!response.ok) {
      throw new Error(`Clerk ${response.status}: ${await response.text()}`);
    }
    const users = await response.json();
    for (const user of users) {
      const email = primaryEmail(user);
      if (email) byEmail.set(email, user.id);
    }
    if (users.length < 100) return byEmail;
  }
}

async function supabaseRequest(url, serviceKey, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${url} ${response.status}: ${await response.text()}`,
    );
  }
  return response.json();
}

async function main() {
  const clerkSecretKey = required("CLERK_SECRET_KEY");
  const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");

  const usersByEmail = await listClerkUsers(clerkSecretKey);
  console.log(`Clerk users: ${usersByEmail.size}`);

  const sales = await supabaseRequest(
    `${supabaseUrl}/rest/v1/sales?select=id,user_id,email`,
    serviceKey,
  );
  const legacy = sales.filter((sale) => UUID_RE.test(sale.user_id));
  console.log(`Legacy sales: ${legacy.length} of ${sales.length}`);

  let updated = 0;
  for (const sale of legacy) {
    const clerkId = usersByEmail.get(String(sale.email).toLowerCase());
    if (!clerkId) {
      console.log(`skip ${sale.email}: no Clerk user with that email`);
      continue;
    }
    if (APPLY) {
      await supabaseRequest(
        `${supabaseUrl}/rest/v1/sales?id=eq.${sale.id}`,
        serviceKey,
        {
          method: "PATCH",
          body: JSON.stringify({ user_id: clerkId }),
        },
      );
      updated += 1;
    } else {
      console.log(`would map ${sale.email}: ${sale.user_id} -> ${clerkId}`);
    }
  }

  console.log(
    APPLY
      ? `Updated ${updated} row(s).`
      : "Dry run: rerun with --apply to write the changes.",
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
