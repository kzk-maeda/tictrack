"use client";

import { useRouter } from "next/navigation";
import { Nav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("demo");

  const handleExitDemo = () => {
    // Clear demo mode flag from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("isDemoMode");
    }
    router.push("/auth");
  };

  return (
    <>
      {/* Demo Mode Banner */}
      <div className="bg-yellow-50 border-b border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎭</span>
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                {t("title")}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {t("description")}
              </p>
            </div>
          </div>
          <Button
            onClick={handleExitDemo}
            variant="outline"
            size="sm"
            className="border-yellow-300 hover:bg-yellow-100 dark:border-yellow-700 dark:hover:bg-yellow-900/40"
          >
            {t("exit")}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <Nav />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </>
  );
}
