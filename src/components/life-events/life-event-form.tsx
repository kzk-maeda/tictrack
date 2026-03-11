"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import type { LifeEvent, LifeEventType } from "@/lib/types";

interface LifeEventFormProps {
  event?: LifeEvent;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export function LifeEventForm({ event, onSubmit, onCancel }: LifeEventFormProps) {
  const t = useTranslations("lifeEvents.form");
  const tTypes = useTranslations("lifeEvents.types");
  const tCommon = useTranslations("common");

  const [eventType, setEventType] = useState<LifeEventType>(
    event?.eventType || "other"
  );
  const [title, setTitle] = useState(event?.title || "");
  const [occurredAt, setOccurredAt] = useState(
    event?.occurredAt ? event.occurredAt.split("T")[0] : ""
  );
  const [endDate, setEndDate] = useState(
    event?.endDate ? event.endDate.split("T")[0] : ""
  );
  const [notes, setNotes] = useState(event?.notes || "");
  const [stressLevel, setStressLevel] = useState<string>(
    event?.stressLevel?.toString() || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventTypes: LifeEventType[] = [
    "graduation",
    "school_transfer",
    "relocation",
    "family_change",
    "medical",
    "social",
    "other",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(t("errorTitleRequired"));
      return;
    }

    if (!occurredAt) {
      setError(t("errorDateRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        eventType,
        title: title.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
        stressLevel: stressLevel ? parseInt(stressLevel) : undefined,
      });
    } catch (err) {
      setError(t("errorGeneral"));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-6">
          {event ? t("titleEdit") : t("titleAdd")}
        </h2>
      </div>

      {/* Event Type */}
      <div>
        <Label htmlFor="eventType">{t("eventType")}</Label>
        <Select value={eventType} onValueChange={(v) => setEventType(v as LifeEventType)}>
          <SelectTrigger id="eventType">
            <SelectValue placeholder={t("eventTypePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {tTypes(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Title */}
      <div>
        <Label htmlFor="title">{t("title")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
          required
        />
      </div>

      {/* Occurred At */}
      <div>
        <Label htmlFor="occurredAt">{t("occurredAt")}</Label>
        <Input
          id="occurredAt"
          type="date"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          required
        />
      </div>

      {/* End Date (Optional) */}
      <div>
        <Label htmlFor="endDate">{t("endDate")}</Label>
        <Input
          id="endDate"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {/* Stress Level (Optional) */}
      <div>
        <Label htmlFor="stressLevel">{t("stressLevel")}</Label>
        <Select value={stressLevel} onValueChange={setStressLevel}>
          <SelectTrigger id="stressLevel">
            <SelectValue placeholder={t("stressLevelPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4">4</SelectItem>
            <SelectItem value="5">5</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notesPlaceholder")}
          rows={4}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? tCommon("saving") : tCommon("save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
