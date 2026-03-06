"use client";

import { useTranslations } from "next-intl";
import { Nav } from "@/components/layout/nav";
import { TicCardsList } from "@/components/tic-cards/tic-cards-list";

export default function TicCardsPage() {
  const t = useTranslations("ticCards");

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="container max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
        <TicCardsList />
      </main>
    </div>
  );
}
