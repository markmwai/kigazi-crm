// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  getPrimaryEmail,
  isUuid,
  toAdminUpdate,
  toUserRow,
  type ClerkWebhookEvent,
} from "./clerkWebhook";

const event = (type: string, data: ClerkWebhookEvent["data"]) =>
  ({ type, data }) satisfies ClerkWebhookEvent;

const email = (id: string, address: string) => ({
  id,
  email_address: address,
});

describe("toUserRow", () => {
  it("maps the primary email even when it is not the first address", () => {
    const row = toUserRow(
      event("user.created", {
        id: "user_2abc",
        first_name: "Ada",
        last_name: "Lovelace",
        primary_email_address_id: "email_2",
        email_addresses: [
          email("email_1", "ada@old.example"),
          email("email_2", "Ada@Kigazi.com"),
        ],
      }),
    );

    expect(row).toEqual({
      user_id: "user_2abc",
      email: "ada@kigazi.com",
      first_name: "Ada",
      last_name: "Lovelace",
    });
  });

  it("falls back to the first address and omits missing names", () => {
    const row = toUserRow(
      event("user.updated", {
        id: "user_2abc",
        email_addresses: [email("email_1", "ada@kigazi.com")],
      }),
    );

    expect(row).toEqual({
      user_id: "user_2abc",
      email: "ada@kigazi.com",
      first_name: undefined,
      last_name: undefined,
    });
  });

  it("ignores users without an email or id, and unrelated events", () => {
    expect(
      toUserRow(
        event("user.created", { id: "user_2abc", email_addresses: [] }),
      ),
    ).toBeUndefined();
    expect(
      toUserRow(
        event("user.created", {
          email_addresses: [email("email_1", "ada@kigazi.com")],
        }),
      ),
    ).toBeUndefined();
    expect(
      toUserRow(
        event("session.created", {
          id: "user_2abc",
          email_addresses: [email("email_1", "ada@kigazi.com")],
        }),
      ),
    ).toBeUndefined();
  });

  it("prefers the primary address when the payload marks a missing one", () => {
    expect(
      getPrimaryEmail({
        primary_email_address_id: "email_missing",
        email_addresses: [email("email_1", "ada@kigazi.com")],
      }),
    ).toBe("ada@kigazi.com");
  });
});

describe("toAdminUpdate", () => {
  const membership = (type: string, role?: string) =>
    event(type, {
      role,
      public_user_data: { user_id: "user_2abc" },
    });

  it("grants admin for org:admin", () => {
    expect(
      toAdminUpdate(membership("organizationMembership.created", "org:admin")),
    ).toEqual({ user_id: "user_2abc", administrator: true });
  });

  it("revokes admin for members and deletions", () => {
    expect(
      toAdminUpdate(membership("organizationMembership.updated", "org:member")),
    ).toEqual({ user_id: "user_2abc", administrator: false });
    expect(toAdminUpdate(membership("organizationMembership.deleted"))).toEqual(
      {
        user_id: "user_2abc",
        administrator: false,
      },
    );
  });

  it("ignores non-membership and id-less events", () => {
    expect(
      toAdminUpdate(membership("user.updated", "org:admin")),
    ).toBeUndefined();
    expect(
      toAdminUpdate(
        event("organizationMembership.created", { role: "org:admin" }),
      ),
    ).toBeUndefined();
  });
});

describe("isUuid", () => {
  it("separates legacy Supabase ids from Clerk ids", () => {
    expect(isUuid("2f1c9b3e-6a4d-4e58-9f70-0c1f2d3e4a5b")).toBe(true);
    expect(isUuid("user_2abc")).toBe(false);
  });
});
