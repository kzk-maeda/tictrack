"use client";

import { useTranslations } from "next-intl";
import { MedicationsList } from "@/components/medications/medications-list";

export default function MedicationsPage() {
  const t = useTranslations("medications");

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
      <MedicationsList />
    </div>
  );
}
