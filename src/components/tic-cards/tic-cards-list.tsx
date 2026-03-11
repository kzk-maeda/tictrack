"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TicCardCard } from "./tic-card-card";
import { TicCardForm } from "./tic-card-form";
import { useChildren } from "@/hooks/use-children";
import { useTicCards } from "@/hooks/use-tic-cards";
import { useEpisodes } from "@/hooks/use-episodes";
import { toast } from "@/hooks/use-toast";
import type { TicCard } from "@/lib/types";
import { getSymptomName } from "@/lib/tic-symptoms";

export function TicCardsList() {
  const router = useRouter();
  const locale = useLocale() as "ja" | "en";
  const t = useTranslations("ticCards");
  const tChildren = useTranslations("children");
  const tCommon = useTranslations("common");
  const { children, isLoading: childrenLoading } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Auto-select default child if no child is selected
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      const defaultChild = children.find((c) => c.isDefault);
      if (defaultChild) {
        setSelectedChildId(defaultChild.childId);
      }
    }
  }, [selectedChildId, children]);

  const {
    ticCards,
    isLoading: cardsLoading,
    error: cardsError,
    createTicCard,
    updateTicCard,
    deleteTicCard,
  } = useTicCards(selectedChildId);

  const { createEpisode } = useEpisodes(selectedChildId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<TicCard | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TicCard | null>(null);

  // Helper to get display label from card
  const getCardLabel = (card: TicCard): string => {
    if (card.symptomId) {
      return getSymptomName(card.symptomId, locale);
    }
    return card.customSymptom || card.label || "";
  };

  const handleEdit = (card: TicCard) => {
    setEditingCard(card);
    setFormOpen(true);
  };

  const handleDelete = async (card: TicCard) => {
    if (deleteConfirm?.cardId === card.cardId) {
      await deleteTicCard(card.cardId);
      setDeleteConfirm(null);
      toast({
        title: t("toast.deleted"),
        description: t("toast.deletedDescription", { label: getCardLabel(card) }),
      });
    } else {
      setDeleteConfirm(card);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleQuickLog = async (card: TicCard) => {
    try {
      await createEpisode({
        recordType: "quick_log",
        ticCardId: card.cardId,
        occurredAt: new Date().toISOString(),
        context: "unknown",
      });
      toast({
        title: t("toast.logged"),
        description: t("toast.loggedDescription", { label: getCardLabel(card) }),
      });
    } catch (e) {
      toast({
        title: t("toast.errorLog"),
        description: e instanceof Error ? e.message : t("toast.errorLogDescription"),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (data: {
    type: "motor" | "vocal";
    complexity: "simple" | "complex";
    symptomId?: string;
    customSymptom?: string;
    severity: number;
    description?: string;
    isActive?: boolean;
  }) => {
    // Generate display label for toast
    const label = data.symptomId
      ? getSymptomName(data.symptomId, locale)
      : data.customSymptom || "";

    if (editingCard) {
      await updateTicCard(editingCard.cardId, data);
      toast({
        title: t("toast.updated"),
        description: t("toast.updatedDescription", { label }),
      });
    } else {
      await createTicCard(data);
      toast({
        title: t("toast.created"),
        description: t("toast.createdDescription", { label }),
      });
    }
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingCard(null);
  };

  if (childrenLoading) {
    return <p className="text-muted-foreground">{tCommon("loading")}</p>;
  }

  return (
    <div>
      <div className="mb-6 space-y-2">
        <Label htmlFor="child-select">{tChildren("selectChild")}</Label>
        <Select
          value={selectedChildId || ""}
          onValueChange={(v) => setSelectedChildId(v || null)}
        >
          <SelectTrigger id="child-select" className="w-full">
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

      {!selectedChildId ? (
        <p className="text-muted-foreground text-center py-8">
          {tChildren("selectPlaceholder")}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t("titleShort")}</h2>
            <Button
              size="sm"
              onClick={() => {
                setEditingCard(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("add")}
            </Button>
          </div>

          {cardsLoading ? (
            <p className="text-muted-foreground">{tCommon("loading")}</p>
          ) : cardsError ? (
            <p className="text-destructive">{cardsError}</p>
          ) : ticCards.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("noCards")}
            </p>
          ) : (
            <div className="space-y-3">
              {ticCards.map((card) => (
                <TicCardCard
                  key={card.cardId}
                  card={card}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onQuickLog={handleQuickLog}
                />
              ))}
            </div>
          )}
        </>
      )}

      {deleteConfirm && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-md text-sm">
          {tChildren("deleteConfirm", { name: getCardLabel(deleteConfirm) })}
        </div>
      )}

      <TicCardForm
        open={formOpen}
        onOpenChange={handleFormClose}
        card={editingCard}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
