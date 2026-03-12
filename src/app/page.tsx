"use client";

import { useEffect } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import Link from "next/link";

export default function Home() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const router = useRouter();
  const t = useTranslations("landing");

  // Auto-redirect authenticated users
  useEffect(() => {
    if (authStatus === "authenticated") {
      router.push("/timeline");
    }
  }, [authStatus, router]);

  // Show landing page for unauthenticated users
  if (authStatus === "unauthenticated") {
    return (
      <main className="flex min-h-screen flex-col bg-gradient-to-br from-background via-secondary/20 to-background">
        {/* Header with Language Switcher */}
        <header className="flex justify-end p-4">
          <LanguageSwitcher />
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
          <div className="max-w-2xl text-center space-y-8 animate-fade-in-up">
            {/* Logo */}
            <div className="space-y-2">
              <h1 className="text-6xl font-bold text-primary animate-breathe">
                TicTrack
              </h1>
              <p className="text-xl text-muted-foreground">
                {t("tagline")}
              </p>
            </div>

            {/* Description */}
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              {t("description")}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button asChild size="lg" className="text-lg px-8">
                <Link href="/auth">
                  {t("getStarted")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8">
                <Link href="/demo/timeline">
                  {t("tryDemo")}
                </Link>
              </Button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
              <div className="space-y-2">
                <div className="text-4xl">📹</div>
                <h3 className="font-semibold">{t("feature1Title")}</h3>
                <p className="text-sm text-muted-foreground">{t("feature1Description")}</p>
              </div>
              <div className="space-y-2">
                <div className="text-4xl">🤖</div>
                <h3 className="font-semibold">{t("feature2Title")}</h3>
                <p className="text-sm text-muted-foreground">{t("feature2Description")}</p>
              </div>
              <div className="space-y-2">
                <div className="text-4xl">📊</div>
                <h3 className="font-semibold">{t("feature3Title")}</h3>
                <p className="text-sm text-muted-foreground">{t("feature3Description")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-6 text-center text-sm text-muted-foreground">
          {t("footer")}
        </footer>
      </main>
    );
  }

  // Loading state
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="text-center animate-fade-in-up">
        <h1 className="text-5xl font-semibold mb-6 text-primary animate-breathe">
          TicTrack
        </h1>
        <p className="text-muted-foreground text-lg">Loading...</p>
      </div>
    </main>
  );
}
