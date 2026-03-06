"use client";

import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

export default function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">TicTrack</h1>
          <p className="text-muted-foreground mt-2">
            子どものチック症状を記録・分析
          </p>
        </div>
        <Authenticator
          signUpAttributes={["email"]}
          components={{
            SignUp: {
              FormFields() {
                return (
                  <>
                    <Authenticator.SignUp.FormFields />
                    <div className="mt-4 space-y-3 text-sm">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          name="coppa_guardian"
                          required
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          私は18歳以上の保護者/養育者であることを確認します
                        </span>
                      </label>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          name="coppa_consent"
                          required
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          子どものデータ収集・処理に同意します。データはチック症状の記録・分析のみに使用されます。
                        </span>
                      </label>
                    </div>
                  </>
                );
              },
            },
          }}
        >
          <AuthRedirect />
        </Authenticator>
      </div>
    </div>
  );
}
