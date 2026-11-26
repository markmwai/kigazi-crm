import {
  useClerk,
  useOrganization,
  useOrganizationList,
} from "@clerk/clerk-react";
import { Check, ChevronDown, Plus, Settings2 } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getClerk } from "../auth/clerk";

const triggerClassName =
  "flex h-8 items-center gap-2 rounded-md border border-border bg-card px-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const itemClassName = "gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium";

/**
 * Clerk owns workspaces. Mounts only when Clerk is configured, so the FakeRest
 * demo (no ClerkProvider) and the unit tests keep working.
 */
export const WorkspaceSwitcher = () =>
  getClerk() ? <ClerkWorkspaceSwitcher /> : null;

const initials = (name?: string) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const OrgAvatar = ({
  name,
  imageUrl,
  hasImage,
}: {
  name?: string;
  imageUrl?: string;
  hasImage?: boolean;
}) => (
  <Avatar className="size-6 shrink-0 rounded-md">
    {hasImage && imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
    <AvatarFallback className="rounded-md text-[10px] font-bold uppercase">
      {initials(name) || "?"}
    </AvatarFallback>
  </Avatar>
);

const ClerkWorkspaceSwitcher = () => {
  const { organization } = useOrganization();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { pageSize: 50 },
  });
  const clerk = useClerk();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const memberships = userMemberships?.data ?? [];

  const switchTo = async (organizationId: string) => {
    if (!setActive || organizationId === organization?.id) return;
    setPendingId(organizationId);
    try {
      await setActive({ organization: organizationId });
      // The session token carries the new org_role, which drives is_admin() and
      // canAccess(). Reload so identity and every request use the new session.
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch workspace", error);
      setPendingId(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={triggerClassName}
            aria-label="Switch workspace"
          />
        }
      >
        <OrgAvatar
          name={organization?.name}
          imageUrl={organization?.imageUrl}
          hasImage={organization?.hasImage}
        />
        <span className="hidden max-w-32 truncate text-[13px] font-semibold xl:inline">
          {organization?.name ?? "Select workspace"}
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground"
          strokeWidth={1.6}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 rounded-xl border-border bg-popover p-1.5 shadow-lg"
      >
        <DropdownMenuLabel className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        {!isLoaded ? (
          <DropdownMenuItem disabled className={itemClassName}>
            Loading…
          </DropdownMenuItem>
        ) : memberships.length === 0 ? (
          <DropdownMenuItem disabled className={itemClassName}>
            No workspaces yet
          </DropdownMenuItem>
        ) : (
          memberships.map((item) => {
            const isActive = item.organization.id === organization?.id;
            return (
              <DropdownMenuItem
                key={item.id}
                disabled={pendingId === item.organization.id}
                onClick={() => switchTo(item.organization.id)}
                className={itemClassName}
              >
                <OrgAvatar
                  name={item.organization.name}
                  imageUrl={item.organization.imageUrl}
                  hasImage={item.organization.hasImage}
                />
                <span className="flex-1 truncate">
                  {item.organization.name}
                </span>
                {item.role === "org:admin" ? (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Admin
                  </span>
                ) : null}
                {isActive ? (
                  <Check className="size-4 shrink-0 text-primary" />
                ) : null}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => clerk.openCreateOrganization()}
          className={itemClassName}
        >
          <Plus />
          Create workspace
        </DropdownMenuItem>
        {organization ? (
          <DropdownMenuItem
            onClick={() => clerk.openOrganizationProfile()}
            className={itemClassName}
          >
            <Settings2 />
            Manage workspace
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
