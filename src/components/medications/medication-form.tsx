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
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useTranslations, useLocale } from "next-intl";
import {
  getAvailableMedications,
  getMedicationDisplayName,
  type MedicationMaster,
} from "@/lib/medication-master";
import type {
  MedicationCardResponse,
  CreateMedicationCardRequest,
} from "@/lib/api";

interface MedicationFormProps {
  medication?: MedicationCardResponse;
  onSubmit: (request: CreateMedicationCardRequest) => Promise<void>;
  onCancel: () => void;
}

export function MedicationForm({
  medication,
  onSubmit,
  onCancel,
}: MedicationFormProps) {
  const t = useTranslations("medications.form");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [selectedMedicationId, setSelectedMedicationId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [dosageMg, setDosageMg] = useState<string>("");
  const [frequency, setFrequency] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableMedications = getAvailableMedications();

  useEffect(() => {
    if (medication) {
      setCustomName(medication.medicationName);
      setDosageMg(medication.dosageMg.toString());
      setFrequency(medication.frequency || "");
      setNotes(medication.notes || "");
      setIsActive(medication.isActive);
    }
  }, [medication]);

  const selectedMedication = availableMedications.find(
    (m) => m.id === selectedMedicationId
  );

  const handleMedicationSelect = (medicationId: string) => {
    setSelectedMedicationId(medicationId);
    const med = availableMedications.find((m) => m.id === medicationId);
    if (med && medicationId !== "custom") {
      setCustomName(getMedicationDisplayName(med, locale));
    } else {
      setCustomName("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customName.trim()) {
      setError(t("errorNameRequired"));
      return;
    }

    if (!dosageMg || parseFloat(dosageMg) <= 0) {
      setError(t("errorDosageRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        medicationName: customName.trim(),
        medicationType: selectedMedication?.type || "other",
        dosageMg: parseFloat(dosageMg),
        frequency: frequency.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneral"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-6">
        {medication ? t("titleEdit") : t("titleAdd")}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Medication Selection */}
        {!medication && (
          <div className="space-y-2">
            <Label htmlFor="medication">{t("medication")}</Label>
            <Select
              value={selectedMedicationId}
              onValueChange={handleMedicationSelect}
            >
              <SelectTrigger id="medication">
                <SelectValue placeholder={t("medicationPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {availableMedications.map((med) => (
                  <SelectItem key={med.id} value={med.id}>
                    {getMedicationDisplayName(med, locale)}
                  </SelectItem>
                ))}
                <SelectItem value="custom">{t("medicationCustom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Custom Name (for editing or custom medication) */}
        {(medication || selectedMedicationId === "custom") && (
          <div className="space-y-2">
            <Label htmlFor="customName">{t("medicationName")}</Label>
            <Input
              id="customName"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={t("medicationNamePlaceholder")}
              required
            />
          </div>
        )}

        {/* Dosage */}
        <div className="space-y-2">
          <Label htmlFor="dosage">{t("dosage")}</Label>
          <div className="flex gap-2 items-center">
            <Input
              id="dosage"
              type="number"
              step="0.01"
              min="0"
              value={dosageMg}
              onChange={(e) => setDosageMg(e.target.value)}
              placeholder="0"
              required
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">mg</span>
          </div>
          {selectedMedication && selectedMedication.commonDosages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs text-muted-foreground">{t("commonDosages")}:</span>
              {selectedMedication.commonDosages.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDosageMg(d.toString())}
                  className="h-7 text-xs"
                >
                  {d}mg
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Frequency */}
        <div className="space-y-2">
          <Label htmlFor="frequency">{t("frequency")}</Label>
          <Input
            id="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder={t("frequencyPlaceholder")}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">{t("notes")}</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={3}
          />
        </div>

        {/* Active Status */}
        <div className="flex items-center justify-between">
          <Label htmlFor="isActive" className="cursor-pointer">
            {t("active")}
          </Label>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? tCommon("saving") : tCommon("save")}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
