"use client";

import { useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/date-utils";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Episode, TicCard } from "@/lib/types";

interface EpisodeCardProps {
  episode: Episode;
  ticCard?: TicCard;
  onDelete?: () => void;
}

export function EpisodeCard({ episode, ticCard, onDelete }: EpisodeCardProps) {
  const locale = useLocale();
  const t = useTranslations("timeline");
  const tCommon = useTranslations("common");
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const occurredDate = new Date(episode.occurredAt);
  const timeString = formatTime(occurredDate, locale);

  const recordTypeLabel =
    episode.recordType === "quick_log" ? t("recordTypeQuick") : t("recordTypeVideo");

  const contextLabel = episode.context || t("contextUnknown");

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    setIsDeleting(true);
    try {
      await apiClient(`/children/${episode.childId}/episodes/${episode.episodeId}`, {
        method: "DELETE",
      });
      toast({
        title: t("deleteSuccess"),
        description: t("deleteSuccessDescription"),
      });
      onDelete?.();
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        variant: "destructive",
        title: t("deleteError"),
        description: error instanceof Error ? error.message : t("deleteErrorDescription"),
      });
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

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
          <Button
            variant={confirmDelete ? "destructive" : "ghost"}
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
