"use client";

import { useMemo, useState, useEffect } from "react";
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
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Video, ChevronLeft, ChevronRight } from "lucide-react";
import { TimelineDayGroup } from "./timeline-day-group";
import { useChildren } from "@/hooks/use-children";
import { useEpisodes } from "@/hooks/use-episodes";
import { useTicCards } from "@/hooks/use-tic-cards";
import { useMedications } from "@/hooks/use-medications";
import { listMedicationLogs, type MedicationLogResponse } from "@/lib/api";
import type { Episode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TimelineProps {
  selectedChildId: string | null;
  onSelectChild: (childId: string | null) => void;
  isDemoMode?: boolean;
}

export function Timeline({ selectedChildId, onSelectChild, isDemoMode = false }: TimelineProps) {
  const router = useRouter();
  const t = useTranslations("timeline");
  const tChildren = useTranslations("children");
  const tCommon = useTranslations("common");
  const tCapture = useTranslations("capture");
  const { children, isLoading: childrenLoading } = useChildren();
  const { episodes, isLoading: episodesLoading, error: episodesError, createEpisode, refresh } =
    useEpisodes(selectedChildId);
  const { ticCards } = useTicCards(selectedChildId);
  const { medications } = useMedications(selectedChildId);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState(true);
  const [month, setMonth] = useState<Date>(new Date());
  const [medicationLogs, setMedicationLogs] = useState<MedicationLogResponse[]>([]);

  // Fetch medication logs
  useEffect(() => {
    if (!selectedChildId) {
      setMedicationLogs([]);
      return;
    }

    listMedicationLogs(selectedChildId)
      .then(setMedicationLogs)
      .catch((err) => {
        console.error("Failed to fetch medication logs:", err);
        setMedicationLogs([]);
      });
  }, [selectedChildId]);

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

  // Group episodes and medication logs by date (YYYY-MM-DD)
  const groupedRecords = useMemo(() => {
    const groups: Record<string, Array<Episode | MedicationLogResponse>> = {};

    // Add episodes
    episodes.forEach((episode) => {
      const date = episode.occurredAt.split("T")[0]; // YYYY-MM-DD
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(episode);
    });

    // Add medication logs
    medicationLogs.forEach((log) => {
      const date = log.takenAt.split("T")[0]; // YYYY-MM-DD
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(log);
    });

    // Sort each day's records by time (descending)
    Object.keys(groups).forEach((date) => {
      groups[date].sort((a, b) => {
        const timeA = "occurredAt" in a ? a.occurredAt : a.takenAt;
        const timeB = "occurredAt" in b ? b.occurredAt : b.takenAt;
        return timeB.localeCompare(timeA);
      });
    });

    return groups;
  }, [episodes, medicationLogs]);

  // Get dates with records for modifiers
  const datesWithRecords = useMemo(() => {
    return Object.keys(groupedRecords).map((dateStr) => new Date(dateStr));
  }, [groupedRecords]);

  // Get record count for each date
  const recordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(groupedRecords).forEach((date) => {
      counts[date] = groupedRecords[date].length;
    });
    return counts;
  }, [groupedRecords]);

  // Custom day formatter with record count
  const formatDay = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const count = recordCounts[dateStr];
    return (
      <div className="relative flex items-center justify-center">
        {date.getDate()}
        {count && count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-accent text-accent-foreground text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
            {count}
          </span>
        )}
      </div>
    );
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setShowCalendar(false);
    }
  };

  const selectedDateStr = selectedDate?.toISOString().split("T")[0];
  const selectedDayRecords = selectedDateStr ? groupedRecords[selectedDateStr] : undefined;

  if (childrenLoading) {
    return <p className="text-muted-foreground">{tCommon("loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
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
      {selectedChildId && !isDemoMode && (
        <Button
          onClick={handleRecordVideo}
          className="w-full"
          size="lg"
        >
          <Video className="mr-2 h-5 w-5" />
          {tCapture("title")}
        </Button>
      )}

      {!selectedChildId ? (
        <p className="text-muted-foreground text-center py-8">
          {tChildren("selectPlaceholder")}
        </p>
      ) : episodesLoading ? (
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      ) : episodesError ? (
        <p className="text-destructive">{episodesError}</p>
      ) : (
        <>
          {/* Calendar View */}
          {showCalendar && (
            <Card className="p-4 animate-fade-in-up">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">{t("selectDate")}</h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const newMonth = new Date(month);
                      newMonth.setMonth(month.getMonth() - 1);
                      setMonth(newMonth);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const newMonth = new Date(month);
                      newMonth.setMonth(month.getMonth() + 1);
                      setMonth(newMonth);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                month={month}
                onMonthChange={setMonth}
                className="mx-auto"
                modifiers={{
                  hasRecords: datesWithRecords,
                }}
                modifiersClassNames={{
                  hasRecords: "font-semibold",
                }}
                disabled={(date) => {
                  const dateStr = date.toISOString().split("T")[0];
                  return !groupedRecords[dateStr];
                }}
                formatters={{
                  formatDay: formatDay as any,
                }}
              />
              {episodes.length === 0 && medicationLogs.length === 0 && (
                <p className="text-muted-foreground text-center mt-4">
                  {t("noRecords")}
                </p>
              )}
            </Card>
          )}

          {/* Selected Date Timeline */}
          {!showCalendar && selectedDate && selectedDayRecords && (
            <div className="animate-fade-in-up space-y-4">
              <Button
                variant="ghost"
                onClick={() => setShowCalendar(true)}
                className="mb-2"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                {t("backToCalendar")}
              </Button>
              <TimelineDayGroup
                date={selectedDateStr!}
                records={selectedDayRecords}
                ticCards={ticCards}
                medicationCards={medications}
                onRefresh={refresh}
                isDemoMode={isDemoMode}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
