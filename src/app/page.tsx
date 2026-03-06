"use client";

import { useEffect } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function Home() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const router = useRouter();
  const tCommon = useTranslations("common");

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/auth");
    } else if (authStatus === "authenticated") {
      // Redirect to tic-cards as default page
      router.replace("/tic-cards");
    }
  }, [authStatus, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">TicTrack</h1>
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    </main>
  );
}
