"use client";

import { useState, useEffect } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Nav } from "@/components/layout/nav";
import { Timeline } from "@/components/timeline/timeline";

export default function Home() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const router = useRouter();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const tCommon = useTranslations("common");
  const t = useTranslations("timeline");

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/auth");
    }
  }, [authStatus, router]);

  if (authStatus !== "authenticated") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">TicTrack</h1>
          <p className="text-muted-foreground">{tCommon("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="container max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
        <Timeline
          selectedChildId={selectedChildId}
          onSelectChild={setSelectedChildId}
        />
      </main>
    </div>
  );
}
