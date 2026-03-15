"use client";

import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { signUp, type SignUpInput } from "aws-amplify/auth";

function AuthRedirect() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const router = useRouter();

  useEffect(() => {
    if (authStatus === "authenticated") {
      router.replace("/settings");
    }
  }, [authStatus, router]);

  return null;
}

/**
 * Invitation code input — isolated component to avoid Authenticator re-render.
 * Uses uncontrolled input; value is read via DOM ref at submit time.
 */
function InvitationCodeInput({
  inputRef,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const t = useTranslations("auth");
  return (
    <div className="amplify-field">
      <label className="amplify-label" htmlFor="invitationCode">
        {t("invitationCode")}{" "}
        <span className="amplify-field__required">*</span>
      </label>
      <input
        ref={inputRef}
        id="invitationCode"
        name="invitationCode"
        type="text"
        className="amplify-input"
        placeholder={t("invitationCodePlaceholder")}
        defaultValue=""
      />
      <small className="amplify-field__description">
        {t("invitationCodeDescription")}
      </small>
    </div>
  );
}

function CoppaConsent() {
  const t = useTranslations("auth");
  return (
    <div className="mt-4 space-y-3 text-sm">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          name="coppa_guardian"
          required
          className="mt-1 h-4 w-4"
        />
        <span>{t("coppaGuardianFull")}</span>
      </label>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          name="coppa_consent"
          required
          className="mt-1 h-4 w-4"
        />
        <span>{t("coppaConsentFull")}</span>
      </label>
    </div>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const invitationInputRef = useRef<HTMLInputElement>(null);

  const handleDemoMode = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("isDemoMode", "true");
    }
    router.push("/demo/timeline");
  };

  const services = useMemo(
    () => ({
      async handleSignUp(input: SignUpInput) {
        const { username, password } = input;
        const code = invitationInputRef.current?.value?.trim() ?? "";
        if (!code) {
          throw new Error("Invitation code is required");
        }
        return await signUp({
          username,
          password,
          options: {
            userAttributes: { email: username },
            clientMetadata: { invitationCode: code },
            autoSignIn: true,
          },
        });
      },
    }),
    []
  );

  const components = useMemo(
    () => ({
      SignUp: {
        FormFields() {
          return (
            <>
              <Authenticator.SignUp.FormFields />
              <InvitationCodeInput inputRef={invitationInputRef} />
              <CoppaConsent />
            </>
          );
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div suppressHydrationWarning className="flex min-h-screen items-center justify-center bg-background p-4">
      <div suppressHydrationWarning className="w-full max-w-md">
        {/* Language Switcher */}
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">{t("description")}</p>
        </div>

        {/* Demo Mode Button */}
        <div className="mb-6">
          <Button
            onClick={handleDemoMode}
            variant="outline"
            className="w-full"
            size="lg"
          >
            🎭 {t("demoMode")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {t("demoModeDescription")}
          </p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t("or")}
            </span>
          </div>
        </div>

        <Authenticator
          signUpAttributes={["email"]}
          services={services}
          components={components}
        >
          <AuthRedirect />
        </Authenticator>
      </div>
    </div>
  );
}
