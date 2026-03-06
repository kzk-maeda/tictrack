"use client";

import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/date-utils";
import type { Episode, TicCard } from "@/lib/types";

interface EpisodeCardProps {
  episode: Episode;
  ticCard?: TicCard;
}

export function EpisodeCard({ episode, ticCard }: EpisodeCardProps) {
  const locale = useLocale();
  const t = useTranslations("timeline");

  const occurredDate = new Date(episode.occurredAt);
  const timeString = formatTime(occurredDate, locale);

  const recordTypeLabel =
    episode.recordType === "quick_log" ? t("recordTypeQuick") : t("recordTypeVideo");

  const contextLabel = episode.context || t("contextUnknown");

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{timeString}</span>
              <Badge variant="outline" className="text-xs">
                {recordTypeLabel}
              </Badge>
            </div>
            {ticCard ? (
              <p className="text-sm">
                <span className="font-semibold">{ticCard.label}</span>
                {episode.context && episode.context !== "unknown" && (
                  <span className="text-muted-foreground ml-2">
                    - {contextLabel}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {episode.ticCardId ? t("deletedCard") : t("unclassified")}
              </p>
            )}
            {episode.notes && (
              <p className="text-sm text-muted-foreground mt-1">
                {episode.notes}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
