"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import type { MedicationCardResponse } from "@/lib/api";

interface MedicationCardProps {
  medication: MedicationCardResponse;
  onEdit: (medication: MedicationCardResponse) => void;
  onDelete: (medicationId: string) => Promise<void>;
  onLog: (medicationId: string) => Promise<void>;
}

export function MedicationCard({
  medication,
  onEdit,
  onDelete,
  onLog,
}: MedicationCardProps) {
  const { toast } = useToast();
  const t = useTranslations("medications");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }

    try {
      await onDelete(medication.medicationId);
      toast({
        title: t("toast.deleted"),
        description: t("toast.deletedDescription", { name: medication.medicationName }),
      });
    } catch (error) {
      console.error("Failed to delete medication:", error);
      toast({
        variant: "destructive",
        title: t("toast.errorDelete"),
        description: t("toast.errorDeleteDescription"),
      });
    }
  };

  const handleLog = async () => {
    setIsLogging(true);
    try {
      await onLog(medication.medicationId);
      toast({
        title: t("toast.logged"),
        description: t("toast.loggedDescription", { name: medication.medicationName }),
      });
    } catch (error) {
      console.error("Failed to log medication:", error);
      toast({
        variant: "destructive",
        title: t("toast.errorLog"),
        description: t("toast.errorLogDescription"),
      });
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <Card className={`p-4 ${!medication.isActive ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="h-5 w-5 text-primary flex-shrink-0" />
            <h3 className="font-semibold text-lg truncate">
              {medication.medicationName}
            </h3>
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium">{t("dosage")}:</span> {medication.dosageMg}mg
            </p>
            {medication.frequency && (
              <p className="text-muted-foreground">
                <span className="font-medium">{t("frequency")}:</span> {medication.frequency}
              </p>
            )}
            {medication.notes && (
              <p className="text-muted-foreground text-xs mt-2">{medication.notes}</p>
            )}
            {!medication.isActive && (
              <span className="inline-block px-2 py-0.5 text-xs bg-muted rounded">
                {t("inactive")}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {medication.isActive && (
            <Button
              variant="default"
              size="sm"
              onClick={handleLog}
              disabled={isLogging}
            >
              {isLogging ? t("logging") : t("quickLog")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(medication)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant={deleteConfirm ? "destructive" : "ghost"}
            size="icon"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
