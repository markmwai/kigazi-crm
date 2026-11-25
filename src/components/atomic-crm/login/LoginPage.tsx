import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";

import { getSignInUrl, getSignUpUrl } from "../auth/clerk";
import { useConfigurationContext } from "../root/ConfigurationContext";

/**
 * Authentication happens on the Kigazi central hub (kigazi.com). This page only
 * hands the browser over to Clerk, which comes back with a session for this
 * origin. The CRM no longer has its own login form, signup, or password screens.
 */
export const LoginPage = () => {
  const { darkModeLogo, title } = useConfigurationContext();
  const translate = useTranslate();

  return (
    <div className="min-h-screen flex">
      <div className="relative grid w-full lg:grid-cols-2">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div className="absolute inset-0 bg-zinc-900" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            <img className="h-6 mr-2" src={darkModeLogo} alt={title} />
            {title}
          </div>
        </div>
        <div className="flex flex-col justify-center w-full p-4 lg:p-8">
          <div className="w-full space-y-6 lg:mx-auto lg:w-[350px]">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {translate("ra.auth.sign_in")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {translate("crm.auth.sign_in_hint")}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full cursor-pointer"
                onClick={() => window.location.assign(getSignInUrl())}
              >
                {translate("crm.auth.sign_in_central")}
              </Button>
              <Button
                variant="outline"
                className="w-full cursor-pointer"
                onClick={() => window.location.assign(getSignUpUrl())}
              >
                {translate("crm.auth.create_account_central")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
