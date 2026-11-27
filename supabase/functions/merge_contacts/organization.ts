/** Decision for a merge request, kept pure so it is testable without a DB. */
export type MergeAuthorization =
  | { allowed: true; organizationId: string }
  | { allowed: false; status: 403 | 404; message: string };

export const authorizeMerge = (
  contacts: { id: number | string; organization_id: string }[],
  loserId: number,
  winnerId: number,
  organizationId: string | undefined,
): MergeAuthorization => {
  if (!organizationId) {
    return { allowed: false, status: 403, message: "No active organization" };
  }

  // The Postgres driver returns bigint ids as strings, so compare textually.
  const ids = new Set(contacts.map((contact) => String(contact.id)));
  if (!ids.has(String(loserId)) || !ids.has(String(winnerId))) {
    return { allowed: false, status: 404, message: "Contact not found" };
  }

  if (contacts.some((contact) => contact.organization_id !== organizationId)) {
    return {
      allowed: false,
      status: 403,
      message: "Contacts belong to another organization",
    };
  }

  return { allowed: true, organizationId };
};
