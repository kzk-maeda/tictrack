"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();

  const switchLanguage = () => {
    const newLocale = locale === "ja" ? "en" : "ja";
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
      window.location.reload();
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLanguage}
      disabled={isPending}
      title={locale === "ja" ? "Switch to English" : "日本語に切り替え"}
    >
      <Languages className="h-4 w-4 mr-1" />
      {locale === "ja" ? "EN" : "JA"}
    </Button>
  );
}
