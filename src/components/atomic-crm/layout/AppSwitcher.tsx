import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { KeyboardEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ADD_TO_PLAN_URL, type AppCatalogEntry } from "@/lib/apps";
import { readLastUsed, recordLastUsed } from "@/lib/last-used";

export interface AppSwitcherProps {
  /** "home" when rendered on the ecosystem hub. */
  currentAppId: string;
  /** Catalog, already sorted. Typically apps.json with the fallback applied. */
  apps: AppCatalogEntry[];
  /** Customer apps this organization can use. Missing metadata means "all". */
  enabledAppIds: string[];
}

const HOME_URL = "https://kigazi.com/home";

function KMark() {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground text-[10px] font-bold uppercase text-background"
      aria-hidden="true"
    >
      K
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${
        open ? "rotate-180" : ""
      }`}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 4.5 6 7.5l3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg
      className="size-4 shrink-0 text-primary"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m2.5 7.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LastBadge() {
  return (
    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      Last
    </span>
  );
}

export function AppSwitcher({
  currentAppId,
  apps,
  enabledAppIds,
}: AppSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [lastUsedAppId, setLastUsedAppId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const homeApp = apps.find((app) => app.id === "home");
  const productApps = apps.filter((app) => app.id !== "home");
  const homeUrl = homeApp?.url ?? HOME_URL;
  const homeName = homeApp?.name ?? "Kigazi Home";

  const currentName =
    currentAppId === "home"
      ? "Home"
      : (apps.find((app) => app.id === currentAppId)?.name ?? "Kigazi");

  function getItems() {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  }

  function close(refocusTrigger = false) {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const items = getItems();
    items[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLastUsedAppId(readLastUsed()?.appId ?? null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      // Close and return focus to the trigger so Tab resumes from a stable node.
      close(true);
      return;
    }
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    const items = getItems();
    if (items.length === 0) return;

    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Home") {
      items[0].focus();
      return;
    }
    if (event.key === "End") {
      items[items.length - 1].focus();
      return;
    }
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const next = (index + delta + items.length) % items.length;
    items[next].focus();
  }

  const menu = (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-[99] bg-black/40"
          aria-hidden="true"
          onClick={() => close()}
        />
      )}
      <div
        id={menuId}
        ref={menuRef}
        role="menu"
        aria-label="Kigazi apps"
        onKeyDown={onMenuKeyDown}
        className={
          isMobile
            ? "fixed inset-x-0 bottom-0 z-[100] max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-popover p-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-popover-foreground shadow-xl"
            : "absolute left-0 top-[calc(100%+0.5rem)] z-50 w-72 origin-top-left overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
        }
      >
        {currentAppId === "home" ? (
          <div
            role="menuitem"
            tabIndex={-1}
            aria-current="true"
            className="flex w-full cursor-default items-center justify-between gap-2.5 rounded-md bg-accent px-2.5 py-2 text-left text-sm font-medium text-foreground"
          >
            <span className="min-w-0 truncate">{homeName}</span>
            <Check />
          </div>
        ) : (
          <a
            role="menuitem"
            tabIndex={-1}
            href={homeUrl}
            className="flex w-full items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            onClick={() => {
              recordLastUsed("home");
              close();
            }}
          >
            <span className="min-w-0 truncate">{homeName}</span>
            {lastUsedAppId === "home" && <LastBadge />}
          </a>
        )}

        <div className="my-1 h-px bg-border" role="separator" />

        {productApps.map((app) => {
          const locked = !enabledAppIds.includes(app.id);
          if (locked) {
            return (
              <a
                key={app.id}
                role="menuitem"
                tabIndex={-1}
                href={ADD_TO_PLAN_URL}
                aria-label={`Add ${app.name} to your plan`}
                className="flex w-full items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                onClick={() => close()}
              >
                <span className="min-w-0 truncate">{app.name}</span>
                <span className="shrink-0 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                  Add
                </span>
              </a>
            );
          }
          const current = app.id === currentAppId;
          if (current) {
            return (
              <div
                key={app.id}
                role="menuitem"
                tabIndex={-1}
                aria-current="true"
                className="flex w-full cursor-default items-center justify-between gap-2.5 rounded-md bg-accent px-2.5 py-2 text-left text-sm font-medium text-foreground"
              >
                <span className="min-w-0 truncate">{app.name}</span>
                <Check />
              </div>
            );
          }
          return (
            <a
              key={app.id}
              role="menuitem"
              tabIndex={-1}
              href={app.url}
              className="flex w-full items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => {
                recordLastUsed(app.id);
                close();
              }}
            >
              <span className="min-w-0 truncate">{app.name}</span>
              {lastUsedAppId === app.id && <LastBadge />}
            </a>
          );
        })}
      </div>
    </>
  );

  return (
    <div ref={rootRef} className="relative z-40">
      <button
        ref={triggerRef}
        type="button"
        className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Kigazi app switcher, current app: ${currentName}`}
        onClick={() => setOpen((value) => !value)}
      >
        <KMark />
        <span className="max-[767px]:hidden truncate text-[13px] font-semibold">
          {currentName}
        </span>
        <Chevron open={open} />
      </button>

      {open &&
        (isMobile && typeof document !== "undefined"
          ? createPortal(menu, document.body)
          : menu)}
    </div>
  );
}
