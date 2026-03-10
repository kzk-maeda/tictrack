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
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="text-center animate-fade-in-up">
        <h1 className="text-5xl font-serif font-semibold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-breathe">
          TicTrack
        </h1>
        <p className="text-muted-foreground text-lg">{tCommon("loading")}</p>
      </div>
    </main>
  );
}
