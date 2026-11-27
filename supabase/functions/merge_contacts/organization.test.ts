// @vitest-environment node
import { describe, expect, it } from "vitest";

import { authorizeMerge } from "./organization";

const contact = (id: number, organization_id: string) => ({
  id,
  organization_id,
});

describe("authorizeMerge", () => {
  it("allows a merge when both contacts belong to the caller's organization", () => {
    expect(
      authorizeMerge([contact(1, "org_a"), contact(2, "org_a")], 1, 2, "org_a"),
    ).toEqual({ allowed: true, organizationId: "org_a" });
  });

  it("rejects a merge across organizations", () => {
    expect(
      authorizeMerge([contact(1, "org_a"), contact(2, "org_b")], 1, 2, "org_a"),
    ).toEqual({
      allowed: false,
      status: 403,
      message: "Contacts belong to another organization",
    });
  });

  it("rejects a merge without an active organization", () => {
    expect(
      authorizeMerge(
        [contact(1, "org_a"), contact(2, "org_a")],
        1,
        2,
        undefined,
      ),
    ).toEqual({
      allowed: false,
      status: 403,
      message: "No active organization",
    });
  });

  it("matches bigint ids returned as strings by the Postgres driver", () => {
    expect(
      authorizeMerge(
        [
          { id: "1" as unknown as number, organization_id: "org_a" },
          { id: "2" as unknown as number, organization_id: "org_a" },
        ],
        1,
        2,
        "org_a",
      ),
    ).toEqual({ allowed: true, organizationId: "org_a" });
  });

  it("reports a contact that is not visible as not found", () => {
    expect(authorizeMerge([contact(1, "org_a")], 1, 2, "org_a")).toEqual({
      allowed: false,
      status: 404,
      message: "Contact not found",
    });
  });
});
