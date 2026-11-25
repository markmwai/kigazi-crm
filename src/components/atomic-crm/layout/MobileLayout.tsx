import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ScrollRestoration } from "react-router";

import { DataImportProvider } from "../dataImport/DataImportProvider";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { useKigaziIdentity } from "../auth/kigazi-identity";
import { AppSwitcher } from "./AppSwitcher";
import { MobileNavigation } from "./MobileNavigation";
import { PullToRefresh } from "./PullToRefresh";

export const MobileLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  const identity = useKigaziIdentity();
  return (
    <DataImportProvider>
      <ScrollRestoration />
      <PullToRefresh />
      {/* CRM mobile has no top header, so the switcher gets its own row. */}
      {identity && (
        <div className="flex justify-end px-3 pt-3">
          <AppSwitcher
            currentAppId="crm"
            apps={identity.apps}
            enabledAppIds={identity.enabledAppIds}
            organizationName={identity.organizationName}
            onSignOut={identity.signOut}
          />
        </div>
      )}
      <ErrorBoundary FallbackComponent={Error}>
        <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
          {children}
        </Suspense>
      </ErrorBoundary>
      <MobileNavigation />
      <Notification mobileOffset={{ bottom: "72px" }} />
    </DataImportProvider>
  );
};
