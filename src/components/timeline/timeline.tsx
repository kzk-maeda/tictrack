"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { TimelineDayGroup } from "./timeline-day-group";
import { useChildren } from "@/hooks/use-children";
import { useEpisodes } from "@/hooks/use-episodes";
import { useTicCards } from "@/hooks/use-tic-cards";
import type { Episode } from "@/lib/types";

interface TimelineProps {
  selectedChildId: string | null;
  onSelectChild: (childId: string | null) => void;
}

export function Timeline({ selectedChildId, onSelectChild }: TimelineProps) {
  const router = useRouter();
  const t = useTranslations("timeline");
  const tChildren = useTranslations("children");
  const tCommon = useTranslations("common");
  const tCapture = useTranslations("capture");
  const { children, isLoading: childrenLoading } = useChildren();
  const { episodes, isLoading: episodesLoading, error: episodesError, createEpisode, refresh } =
    useEpisodes(selectedChildId);
  const { ticCards } = useTicCards(selectedChildId);

  const handleRecordVideo = async () => {
    if (!selectedChildId) return;

    try {
      // Create a new episode first
      const episode = await createEpisode({
        recordType: "video",
        occurredAt: new Date().toISOString(),
      });

      // Navigate to capture page with childId and episodeId
      router.push(`/capture?childId=${selectedChildId}&episodeId=${episode.episodeId}`);
    } catch (error) {
      console.error("Failed to create episode:", error);
    }
  };

  // Group episodes by date (YYYY-MM-DD)
  const groupedEpisodes = useMemo(() => {
    const sorted = [...episodes].sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    const groups: Record<string, Episode[]> = {};
    sorted.forEach((episode) => {
      const date = episode.occurredAt.split("T")[0]; // YYYY-MM-DD
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(episode);
    });

    return groups;
  }, [episodes]);

  const dates = Object.keys(groupedEpisodes).sort((a, b) =>
    b.localeCompare(a),
  );

  if (childrenLoading) {
    return <p className="text-muted-foreground">{tCommon("loading")}</p>;
  }

  return (
    <div>
      <div className="mb-6 space-y-2">
        <Label htmlFor="child-select-timeline">{tChildren("selectChild")}</Label>
        <Select
          value={selectedChildId || ""}
          onValueChange={(v) => onSelectChild(v || null)}
        >
          <SelectTrigger id="child-select-timeline" className="w-full">
            <SelectValue placeholder={tChildren("selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {children.map((child) => (
              <SelectItem key={child.childId} value={child.childId}>
                {child.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Record Video Button */}
      {selectedChildId && (
        <div className="mb-6">
          <Button
            onClick={handleRecordVideo}
            className="w-full"
            size="lg"
          >
            <Video className="mr-2 h-5 w-5" />
            {tCapture("title")}
          </Button>
        </div>
      )}

      {!selectedChildId ? (
        <p className="text-muted-foreground text-center py-8">
          {tChildren("selectPlaceholder")}
        </p>
      ) : episodesLoading ? (
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      ) : episodesError ? (
        <p className="text-destructive">{episodesError}</p>
      ) : dates.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {t("noRecords")}
        </p>
      ) : (
        <div>
          {dates.map((date) => (
            <TimelineDayGroup
              key={date}
              date={date}
              episodes={groupedEpisodes[date]}
              ticCards={ticCards}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
