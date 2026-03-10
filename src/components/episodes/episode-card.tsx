"use client";

import { useState, useEffect } from "react";
import { Clock, Trash2, Video } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/date-utils";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useEpisodes } from "@/hooks/use-episodes";
import type { Episode, TicCard, AILabel } from "@/lib/types";
import { AILabelSection } from "./ai-label-section";
import { getSymptomName } from "@/lib/tic-symptoms";

interface EpisodeCardProps {
  episode: Episode;
  ticCard?: TicCard;
  aiLabel?: AILabel;
  onDelete?: () => void;
  onUpdate?: () => void;
}

export function EpisodeCard({ episode, ticCard, aiLabel, onDelete, onUpdate }: EpisodeCardProps) {
  const locale = useLocale();
  const t = useTranslations("timeline");
  const tCommon = useTranslations("common");
  const { toast } = useToast();
  const { getVideoUrl } = useEpisodes(episode.childId);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  const occurredDate = new Date(episode.occurredAt);
  const timeString = formatTime(occurredDate, locale);

  const recordTypeLabel =
    episode.recordType === "quick_log" ? t("recordTypeQuick") : t("recordTypeVideo");

  const contextLabel = episode.context || t("contextUnknown");

  // Load video URL if episode has video
  useEffect(() => {
    if (episode.videoS3Key && episode.uploadStatus === "completed") {
      setLoadingVideo(true);
      getVideoUrl(episode.episodeId)
        .then((url) => setVideoUrl(url))
        .catch((err) => {
          console.error("Failed to load video URL:", err);
          toast({
            variant: "destructive",
            title: t("videoLoadError"),
            description: err instanceof Error ? err.message : tCommon("error"),
          });
        })
        .finally(() => setLoadingVideo(false));
    }
  }, [episode.episodeId, episode.videoS3Key, episode.uploadStatus, getVideoUrl, t, tCommon, toast]);

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
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{timeString}</span>
              <Badge variant="outline" className="text-xs">
                {recordTypeLabel}
              </Badge>
              {episode.videoS3Key && (
                <Video className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {ticCard ? (
              <p className="text-sm">
                <span className="font-semibold">
                  {ticCard.symptomId
                    ? getSymptomName(ticCard.symptomId, locale as "ja" | "en")
                    : ticCard.customSymptom || ticCard.label}
                </span>
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

        {/* Video Player */}
        {episode.videoS3Key && (
          <div className="mt-3">
            {loadingVideo ? (
              <div className="flex items-center justify-center h-48 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
              </div>
            ) : videoUrl ? (
              <video
                key={videoUrl}
                controls
                className="w-full rounded-md"
                style={{ maxHeight: "400px" }}
              >
                <source src={videoUrl} type={episode.videoMimeType || "video/mp4"} />
                {t("videoNotSupported")}
              </video>
            ) : (
              <div className="flex items-center justify-center h-48 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">{t("videoLoadError")}</p>
              </div>
            )}
          </div>
        )}

        {/* AI Label Section */}
        <AILabelSection
          episode={episode}
          aiLabel={aiLabel}
          onAnalysisComplete={onUpdate}
          onFeedbackSubmit={onUpdate}
        />
      </CardContent>
    </Card>
  );
}
