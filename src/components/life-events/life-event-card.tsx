"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Calendar, Star } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/date-utils";
import type { LifeEvent } from "@/lib/types";

interface LifeEventCardProps {
  event: LifeEvent;
  onEdit: (event: LifeEvent) => void;
  onDelete: () => void;
}

export function LifeEventCard({ event, onEdit, onDelete }: LifeEventCardProps) {
  const t = useTranslations("lifeEvents");
  const tTypes = useTranslations("lifeEvents.types");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);

  const handleDelete = () => {
    if (deleteConfirmation) {
      onDelete();
    } else {
      setDeleteConfirmation(true);
      setTimeout(() => setDeleteConfirmation(false), 3000);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">{event.title}</h3>
              <span className="text-xs bg-secondary px-2 py-1 rounded">
                {tTypes(event.eventType)}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(new Date(event.occurredAt), locale)}</span>
              </div>
              {event.endDate && (
                <span>→ {formatDate(new Date(event.endDate), locale)}</span>
              )}
            </div>

            {event.stressLevel && (
              <div className="flex items-center gap-2 text-sm mb-2">
                <span className="text-muted-foreground">{t("stressLevel")}:</span>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < event.stressLevel!
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {event.notes && (
              <p className="text-sm text-muted-foreground mt-2">{event.notes}</p>
            )}
          </div>

          <div className="flex gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(event)}
              className="h-8 w-8 p-0"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant={deleteConfirmation ? "destructive" : "ghost"}
              size="sm"
              onClick={handleDelete}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
