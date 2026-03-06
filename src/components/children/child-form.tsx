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
import type { Child } from "@/lib/types";

interface ChildFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child?: Child | null;
  onSubmit: (data: { displayName: string; birthYearMonth: string }) => Promise<void>;
}

export function ChildForm({ open, onOpenChange, child, onSubmit }: ChildFormProps) {
  const t = useTranslations("children.form");
  const tCommon = useTranslations("common");
  const [displayName, setDisplayName] = useState(child?.displayName || "");
  const [birthYearMonth, setBirthYearMonth] = useState(child?.birthYearMonth || "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!child;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError(t("errorNameRequired"));
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(birthYearMonth)) {
      setError(t("errorDateFormat"));
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({ displayName: displayName.trim(), birthYearMonth });
      onOpenChange(false);
      setDisplayName("");
      setBirthYearMonth("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneral"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("titleEdit") : t("titleAdd")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("displayName")}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("displayNamePlaceholder")}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthYearMonth">{t("birthYearMonth")}</Label>
              <Input
                id="birthYearMonth"
                type="month"
                value={birthYearMonth}
                onChange={(e) => setBirthYearMonth(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
