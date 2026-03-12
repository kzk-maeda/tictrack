"use client";

import { useLocale, useTranslations } from "next-intl";
import { Pill } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { EpisodeCard } from "@/components/episodes/episode-card";
import { TimelineCard } from "./timeline-card";
import { formatTime } from "@/lib/date-utils";
import { formatDate } from "@/lib/date-utils";
import { deleteMedicationLog, type MedicationLogResponse } from "@/lib/api/medications";
import type { Episode, TicCard, AILabel, MedicationCard } from "@/lib/types";

interface TimelineDayGroupProps {
  date: string;
  records: Array<Episode | MedicationLogResponse>;
  ticCards: TicCard[];
  medicationCards: MedicationCard[];
  onRefresh?: () => void;
  isDemoMode?: boolean;
}

export function TimelineDayGroup({
  date,
  records,
  ticCards,
  medicationCards,
  onRefresh,
  isDemoMode = false,
}: TimelineDayGroupProps) {
  const locale = useLocale();
  const t = useTranslations("timeline");

  const dateObj = new Date(date);
  const dateString = formatDate(dateObj, locale);

  const isToday =
    dateObj.toDateString() === new Date().toDateString();

  const isMedicationLog = (record: Episode | MedicationLogResponse): record is MedicationLogResponse => {
    return "logId" in record && "medicationId" in record;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold">
          {isToday ? t("today") : dateString}
        </h3>
        <span className="text-sm text-muted-foreground">
          {t("recordCount", { count: records.length })}
        </span>
      </div>
      <div className="space-y-2 mb-6">
        {records.map((record) => {
          if (isMedicationLog(record)) {
            // Medication log
            const medication = medicationCards.find((m) => m.medicationId === record.medicationId);
            const time = formatTime(new Date(record.takenAt), locale);

            return (
              <TimelineCard
                key={record.logId}
                icon={<Pill className="h-5 w-5 text-blue-500" />}
                title={medication?.medicationName || "(Unknown medication)"}
                time={time}
                onDelete={!isDemoMode ? async () => {
                  await deleteMedicationLog(record.childId, record.logId);
                  onRefresh?.();
                } : undefined}
              >
                <div className="text-sm text-muted-foreground">
                  {record.dosageMg ? `${record.dosageMg} mg` : "—"}
                </div>
                {record.notes && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {record.notes}
                  </div>
                )}
              </TimelineCard>
            );
          } else {
            // Episode
            const episode = record;
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
              onDelete={!isDemoMode ? onRefresh : undefined}
              onUpdate={!isDemoMode ? onRefresh : undefined}
              isDemoMode={isDemoMode}
            />
          );
          }
        })}
      </div>
      <Separator className="mb-6" />
    </div>
  );
}
