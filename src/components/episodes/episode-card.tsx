"use client";

import { useState, useEffect } from "react";
import { Clock, Video } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { formatTime } from "@/lib/date-utils";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useEpisodes } from "@/hooks/use-episodes";
import { TimelineCard } from "@/components/timeline/timeline-card";
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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    await apiClient(`/children/${episode.childId}/episodes/${episode.episodeId}`, {
      method: "DELETE",
    });
    toast({
      title: t("deleteSuccess"),
      description: t("deleteSuccessDescription"),
    });
    onDelete?.();
  };

  // Title content
  const titleContent = ticCard ? (
    <span className="font-semibold">
      {ticCard.symptomId
        ? getSymptomName(ticCard.symptomId, locale as "ja" | "en")
        : ticCard.customSymptom || ticCard.label}
    </span>
  ) : (
    <span className="text-muted-foreground">
      {episode.ticCardId ? t("deletedCard") : t("unclassified")}
    </span>
  );

  // Badge content
  const badgeContent = (
    <>
      <Badge variant="outline" className="text-xs">
        {recordTypeLabel}
      </Badge>
      {episode.videoS3Key && <Video className="h-4 w-4 text-muted-foreground" />}
    </>
  );

  return (
    <>
      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        relatedData={aiLabel ? [t("deleteRelatedAILabel")] : undefined}
      />
      <TimelineCard
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        title={titleContent}
        time={timeString}
        badge={badgeContent}
        onDelete={handleDeleteClick}
      >
      {/* Context and Notes */}
      {ticCard && episode.context && episode.context !== "unknown" && (
        <p className="text-sm text-muted-foreground">
          {contextLabel}
        </p>
      )}
      {episode.notes && (
        <p className="text-sm text-muted-foreground mt-1">
          {episode.notes}
        </p>
      )}

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
      </TimelineCard>
    </>
  );
}
