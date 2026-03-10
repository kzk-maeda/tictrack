"use client";

import { useLocale, useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { EpisodeCard } from "@/components/episodes/episode-card";
import { formatDate } from "@/lib/date-utils";
import type { Episode, TicCard, AILabel } from "@/lib/types";

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

          // Extract AI label from episode's originalAILabel field
          let aiLabel: AILabel | undefined;
          if (episode.originalAILabel) {
            try {
              console.log(`=== Timeline Extract for ${episode.episodeId} ===`);
              console.log("Raw originalAILabel:", episode.originalAILabel);

              // originalAILabel is stored as an object in DynamoDB
              const labelData = typeof episode.originalAILabel === 'string'
                ? JSON.parse(episode.originalAILabel)
                : episode.originalAILabel;

              console.log("Parsed labelData:", labelData);
              console.log("labelData.primaryTic:", labelData.primaryTic);

              aiLabel = {
                episodeId: episode.episodeId,
                version: 1,
                modelId: "nova-pro-v1",
                rawOutput: "",
                primaryTic: labelData.primaryTic,
                secondaryTics: labelData.secondaryTics,
                severity: labelData.severity ?? labelData.suggestedSeverity,
                observations: labelData.observations,
                suggestedType: labelData.suggestedType ?? labelData.type,
                suggestedSeverity: labelData.suggestedSeverity ?? labelData.severity,
                suggestedContext: labelData.suggestedContext ?? labelData.context,
                confidence: labelData.confidence ?? labelData.primaryTic?.confidence,
                createdAt: episode.updatedAt,
              };

              console.log("Constructed aiLabel:", aiLabel);
            } catch (error) {
              console.error("Failed to parse AI label:", error);
            }
          }

          return (
            <EpisodeCard
              key={episode.episodeId}
              episode={episode}
              ticCard={ticCard}
              aiLabel={aiLabel}
              onDelete={onRefresh}
              onUpdate={onRefresh}
            />
          );
        })}
      </div>
      <Separator className="mb-6" />
    </div>
  );
}
