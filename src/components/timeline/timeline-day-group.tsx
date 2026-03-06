"use client";

import { useLocale, useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { EpisodeCard } from "@/components/episodes/episode-card";
import { formatDate } from "@/lib/date-utils";
import type { Episode, TicCard } from "@/lib/types";

interface TimelineDayGroupProps {
  date: string;
  episodes: Episode[];
  ticCards: TicCard[];
  onRefresh?: () => void;
}

export function TimelineDayGroup({
  date,
  episodes,
  ticCards,
  onRefresh,
}: TimelineDayGroupProps) {
  const locale = useLocale();
  const t = useTranslations("timeline");

  const dateObj = new Date(date);
  const dateString = formatDate(dateObj, locale);

  const isToday =
    dateObj.toDateString() === new Date().toDateString();

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold">
          {isToday ? t("today") : dateString}
        </h3>
        <span className="text-sm text-muted-foreground">
          {t("recordCount", { count: episodes.length })}
        </span>
      </div>
      <div className="space-y-2 mb-6">
        {episodes.map((episode) => {
          const ticCard = episode.ticCardId
            ? ticCards.find((c) => c.cardId === episode.ticCardId)
            : undefined;
          return (
            <EpisodeCard
              key={episode.episodeId}
              episode={episode}
              ticCard={ticCard}
              onDelete={onRefresh}
            />
          );
        })}
      </div>
      <Separator className="mb-6" />
    </div>
  );
}
