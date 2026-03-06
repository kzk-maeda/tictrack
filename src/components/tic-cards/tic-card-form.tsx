"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import type { TicCard } from "@/lib/types";

interface TicCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: TicCard | null;
  onSubmit: (data: {
    label: string;
    type: "motor" | "vocal";
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
  const [label, setLabel] = useState(card?.label || "");
  const [type, setType] = useState<"motor" | "vocal">(card?.type || "motor");
  const [severity, setSeverity] = useState<number>(card?.severity || 2);
  const [description, setDescription] = useState(card?.description || "");
  const [isActive, setIsActive] = useState(card?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!card;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError(t("errorLabelRequired"));
      return;
    }

    try {
      setIsSubmitting(true);
      const data: {
        label: string;
        type: "motor" | "vocal";
        severity: number;
        description?: string;
        isActive?: boolean;
      } = {
        label: label.trim(),
        type,
        severity,
      };
      if (description.trim()) {
        data.description = description.trim();
      }
      if (isEditing) {
        data.isActive = isActive;
      }
      await onSubmit(data);
      onOpenChange(false);
      setLabel("");
      setType("motor");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("titleEdit") : t("titleAdd")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">{t("label")}</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("labelPlaceholder")}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">{t("type")}</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "motor" | "vocal")}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="motor">{t("typeMotor")}</SelectItem>
                  <SelectItem value="vocal">{t("typeVocal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  <SelectItem value="1">{t("severityMild")}</SelectItem>
                  <SelectItem value="2">{t("severityModerate")}</SelectItem>
                  <SelectItem value="3">{t("severitySevere")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              {isSubmitting ? tCommon("saving") : isEditing ? tCommon("update") : tCommon("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
