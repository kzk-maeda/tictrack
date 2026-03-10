"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { TicCard } from "@/lib/types";
import { groupSymptomsByComplexity, getSymptomById } from "@/lib/tic-symptoms";

interface TicCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: TicCard | null;
  onSubmit: (data: {
    type: "motor" | "vocal";
    complexity: "simple" | "complex";
    symptomId?: string;
    customSymptom?: string;
    severity: number;
    description?: string;
    isActive?: boolean;
  }) => Promise<void>;
}

export function TicCardForm({
  open,
  onOpenChange,
  card,
  onSubmit,
}: TicCardFormProps) {
  const t = useTranslations("ticCards.form");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ja" | "en";

  const [type, setType] = useState<"motor" | "vocal">(card?.type || "motor");
  const [complexity, setComplexity] = useState<"simple" | "complex">(
    card?.complexity || "simple"
  );
  const [symptomId, setSymptomId] = useState<string>(card?.symptomId || "");
  const [customSymptom, setCustomSymptom] = useState(card?.customSymptom || "");
  const [severity, setSeverity] = useState<number>(card?.severity || 2);
  const [description, setDescription] = useState(card?.description || "");
  const [isActive, setIsActive] = useState(card?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!card;

  // Get symptoms for current type and complexity
  const symptomsGrouped = groupSymptomsByComplexity(type);
  const currentSymptoms = complexity === "simple"
    ? symptomsGrouped.simple
    : symptomsGrouped.complex;

  // Reset symptom selection when type or complexity changes
  useEffect(() => {
    if (!isEditing) {
      setSymptomId("");
      setCustomSymptom("");
    }
  }, [type, complexity, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (symptomId === "custom" && !customSymptom.trim()) {
      setError(t("errorCustomSymptomRequired"));
      return;
    }
    if (!symptomId) {
      setError(t("errorSymptomRequired"));
      return;
    }

    try {
      setIsSubmitting(true);
      const data: {
        type: "motor" | "vocal";
        complexity: "simple" | "complex";
        symptomId?: string;
        customSymptom?: string;
        severity: number;
        description?: string;
        isActive?: boolean;
      } = {
        type,
        complexity,
        severity,
      };

      // Set symptom data
      if (symptomId === "custom") {
        data.customSymptom = customSymptom.trim();
      } else {
        data.symptomId = symptomId;
      }

      if (description.trim()) {
        data.description = description.trim();
      }
      if (isEditing) {
        data.isActive = isActive;
      }

      await onSubmit(data);
      onOpenChange(false);

      // Reset form
      setType("motor");
      setComplexity("simple");
      setSymptomId("");
      setCustomSymptom("");
      setSeverity(2);
      setDescription("");
      setIsActive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("errorGeneral"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("titleEdit") : t("titleAdd")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Type Selection */}
            <div className="space-y-2">
              <Label>{t("type")}</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as "motor" | "vocal")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="motor" id="type-motor" />
                  <Label htmlFor="type-motor" className="font-normal cursor-pointer">
                    {t("typeMotor")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="vocal" id="type-vocal" />
                  <Label htmlFor="type-vocal" className="font-normal cursor-pointer">
                    {t("typeVocal")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Complexity Selection */}
            <div className="space-y-2">
              <Label>{t("complexity")}</Label>
              <RadioGroup
                value={complexity}
                onValueChange={(v) => setComplexity(v as "simple" | "complex")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="simple" id="complexity-simple" />
                  <Label htmlFor="complexity-simple" className="font-normal cursor-pointer">
                    {t("complexitySimple")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="complex" id="complexity-complex" />
                  <Label htmlFor="complexity-complex" className="font-normal cursor-pointer">
                    {t("complexityComplex")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Symptom Selection */}
            <div className="space-y-2">
              <Label htmlFor="symptom">{t("symptom")}</Label>
              <Select value={symptomId} onValueChange={setSymptomId}>
                <SelectTrigger id="symptom">
                  <SelectValue placeholder={t("symptomPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {currentSymptoms
                    .filter((s) => s.isCommon)
                    .map((symptom) => (
                      <SelectItem key={symptom.symptomId} value={symptom.symptomId}>
                        {locale === "ja" ? symptom.nameJa : symptom.nameEn}
                      </SelectItem>
                    ))}
                  <SelectItem value="---" disabled>
                    ──────────
                  </SelectItem>
                  {currentSymptoms
                    .filter((s) => !s.isCommon)
                    .map((symptom) => (
                      <SelectItem key={symptom.symptomId} value={symptom.symptomId}>
                        {locale === "ja" ? symptom.nameJa : symptom.nameEn}
                      </SelectItem>
                    ))}
                  <SelectItem value="custom">{t("symptomCustom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Symptom Input */}
            {symptomId === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="customSymptom">{t("customSymptomLabel")}</Label>
                <Input
                  id="customSymptom"
                  value={customSymptom}
                  onChange={(e) => setCustomSymptom(e.target.value)}
                  placeholder={t("customSymptomPlaceholder")}
                  maxLength={100}
                />
              </div>
            )}

            {/* Severity Selection */}
            <div className="space-y-2">
              <Label htmlFor="severity">{t("severity")}</Label>
              <Select
                value={severity.toString()}
                onValueChange={(v) => setSeverity(parseInt(v, 10))}
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("severity1")}</SelectItem>
                  <SelectItem value="2">{t("severity2")}</SelectItem>
                  <SelectItem value="3">{t("severity3")}</SelectItem>
                  <SelectItem value="4">{t("severity4")}</SelectItem>
                  <SelectItem value="5">{t("severity5")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                maxLength={200}
              />
            </div>

            {/* Active Status (Edit Only) */}
            {isEditing && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive" className="font-normal">
                  {t("active")}
                </Label>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? tCommon("saving")
                : isEditing
                ? tCommon("update")
                : tCommon("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
