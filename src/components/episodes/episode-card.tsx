"use client";

import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Episode, TicCard } from "@/lib/types";

interface EpisodeCardProps {
  episode: Episode;
  ticCard?: TicCard;
}

export function EpisodeCard({ episode, ticCard }: EpisodeCardProps) {
  const occurredDate = new Date(episode.occurredAt);
  const timeString = occurredDate.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const recordTypeLabel =
    episode.recordType === "quick_log" ? "ワンタップ" : "動画";

  const contextLabel = episode.context || "不明";

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
                {episode.ticCardId ? "（削除されたカード）" : "（未分類）"}
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
