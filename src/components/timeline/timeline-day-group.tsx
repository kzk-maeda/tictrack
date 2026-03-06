"use client";

import { Separator } from "@/components/ui/separator";
import { EpisodeCard } from "@/components/episodes/episode-card";
import type { Episode, TicCard } from "@/lib/types";

interface TimelineDayGroupProps {
  date: string;
  episodes: Episode[];
  ticCards: TicCard[];
}

export function TimelineDayGroup({
  date,
  episodes,
  ticCards,
}: TimelineDayGroupProps) {
  const dateObj = new Date(date);
  const dateString = dateObj.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const isToday =
    dateObj.toDateString() === new Date().toDateString();

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold">
          {isToday ? "今日" : dateString}
        </h3>
        <span className="text-sm text-muted-foreground">
          ({episodes.length}件)
        </span>
      </div>
      <div className="space-y-2 mb-6">
        {episodes.map((episode) => {
          const ticCard = episode.ticCardId
            ? ticCards.find((c) => c.cardId === episode.ticCardId)
            : undefined;
          return (
            <EpisodeCard key={episode.episodeId} episode={episode} ticCard={ticCard} />
          );
        })}
      </div>
      <Separator className="mb-6" />
    </div>
  );
}
