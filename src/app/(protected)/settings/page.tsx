"use client";

import { useTranslations } from "next-intl";
import { ChildrenList } from "@/components/children/children-list";

export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">{t("title")}</h2>
      <ChildrenList />
    </div>
  );
}
