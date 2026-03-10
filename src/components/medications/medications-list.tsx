"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { MedicationCard } from "./medication-card";
import { MedicationForm } from "./medication-form";
import { useMedications } from "@/hooks/use-medications";
import { useChildren } from "@/hooks/use-children";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { MedicationCardResponse } from "@/lib/api";

export function MedicationsList() {
  const t = useTranslations("medications");
  const tChildren = useTranslations("children");
  const tCommon = useTranslations("common");
  const { toast } = useToast();

  const { children } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const {
    medications,
    isLoading,
    error,
    addMedication,
    updateMedication,
    removeMedication,
    logMedication,
  } = useMedications(selectedChildId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMedication, setEditingMedication] =
    useState<MedicationCardResponse | null>(null);

  // Auto-select default child
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      const defaultChild = children.find((c) => c.isDefault);
      if (defaultChild) {
        setSelectedChildId(defaultChild.childId);
      }
    }
  }, [selectedChildId, children]);

  const handleAdd = () => {
    setEditingMedication(null);
    setIsFormOpen(true);
  };

  const handleEdit = (medication: MedicationCardResponse) => {
    setEditingMedication(medication);
    setIsFormOpen(true);
  };

  const handleSubmit = async (request: any) => {
    try {
      if (editingMedication) {
        await updateMedication(editingMedication.medicationId, request);
        toast({
          title: t("toast.updated"),
          description: t("toast.updatedDescription", { name: request.medicationName }),
        });
      } else {
        await addMedication(request);
        toast({
          title: t("toast.created"),
          description: t("toast.createdDescription", { name: request.medicationName }),
        });
      }
      setIsFormOpen(false);
      setEditingMedication(null);
    } catch (error) {
      throw error;
    }
  };

  const handleLog = async (medicationId: string) => {
    await logMedication(medicationId);
  };

  // Filter medications: show active first, then inactive
  const activeMedications = medications.filter((m) => m.isActive);
  const inactiveMedications = medications.filter((m) => !m.isActive);

  if (isFormOpen) {
    return (
      <MedicationForm
        medication={editingMedication || undefined}
        onSubmit={handleSubmit}
        onCancel={() => {
          setIsFormOpen(false);
          setEditingMedication(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Child Selection */}
      <div className="space-y-2">
        <Label htmlFor="child-select-medications">{tChildren("selectChild")}</Label>
        <Select
          value={selectedChildId || ""}
          onValueChange={(v) => setSelectedChildId(v || null)}
        >
          <SelectTrigger id="child-select-medications">
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

      {/* Add Button */}
      {selectedChildId && (
        <Button onClick={handleAdd} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          {t("add")}
        </Button>
      )}

      {/* Loading/Error States */}
      {isLoading && <p className="text-muted-foreground">{tCommon("loading")}</p>}
      {error && <p className="text-destructive">{error}</p>}

      {/* No Child Selected */}
      {!selectedChildId && !isLoading && (
        <p className="text-muted-foreground text-center py-8">
          {tChildren("selectPlaceholder")}
        </p>
      )}

      {/* Medications List */}
      {selectedChildId && !isLoading && (
        <>
          {/* Active Medications */}
          {activeMedications.length > 0 && (
            <div className="space-y-3">
              {activeMedications.map((medication) => (
                <MedicationCard
                  key={medication.medicationId}
                  medication={medication}
                  onEdit={handleEdit}
                  onDelete={removeMedication}
                  onLog={handleLog}
                />
              ))}
            </div>
          )}

          {/* Inactive Medications */}
          {inactiveMedications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("inactiveMedications")}
              </h3>
              {inactiveMedications.map((medication) => (
                <MedicationCard
                  key={medication.medicationId}
                  medication={medication}
                  onEdit={handleEdit}
                  onDelete={removeMedication}
                  onLog={handleLog}
                />
              ))}
            </div>
          )}

          {/* No Medications */}
          {medications.length === 0 && (
            <p className="text-muted-foreground text-center py-8">{t("noMedications")}</p>
          )}
        </>
      )}
    </div>
  );
}
