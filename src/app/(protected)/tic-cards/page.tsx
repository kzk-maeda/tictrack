"use client";

import { useTranslations } from "next-intl";
import { TicCardsList } from "@/components/tic-cards/tic-cards-list";

export default function TicCardsPage() {
  const t = useTranslations("ticCards");

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
      <TicCardsList />
    </div>
  );
}
