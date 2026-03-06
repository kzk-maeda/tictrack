"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  const { children, isLoading: childrenLoading } = useChildren();
  const { episodes, isLoading: episodesLoading, error: episodesError } =
    useEpisodes(selectedChildId);
  const { ticCards } = useTicCards(selectedChildId);

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
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div>
      <div className="mb-6 space-y-2">
        <Label htmlFor="child-select-timeline">子どもを選択</Label>
        <Select
          value={selectedChildId || ""}
          onValueChange={(v) => onSelectChild(v || null)}
        >
          <SelectTrigger id="child-select-timeline" className="w-full">
            <SelectValue placeholder="子どもを選択してください" />
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

      {!selectedChildId ? (
        <p className="text-muted-foreground text-center py-8">
          子どもを選択してください
        </p>
      ) : episodesLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : episodesError ? (
        <p className="text-destructive">{episodesError}</p>
      ) : dates.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          まだ記録がありません
        </p>
      ) : (
        <div>
          {dates.map((date) => (
            <TimelineDayGroup
              key={date}
              date={date}
              episodes={groupedEpisodes[date]}
              ticCards={ticCards}
            />
          ))}
        </div>
      )}
    </div>
  );
}
