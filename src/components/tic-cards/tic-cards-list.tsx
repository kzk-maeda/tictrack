"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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

export function TicCardsList() {
  const { children, isLoading: childrenLoading } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

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

  const handleEdit = (card: TicCard) => {
    setEditingCard(card);
    setFormOpen(true);
  };

  const handleDelete = async (card: TicCard) => {
    if (deleteConfirm?.cardId === card.cardId) {
      await deleteTicCard(card.cardId);
      setDeleteConfirm(null);
      toast({
        title: "削除しました",
        description: `「${card.label}」を削除しました`,
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
        title: "記録しました",
        description: `「${card.label}」を記録しました`,
      });
    } catch (e) {
      toast({
        title: "エラー",
        description: e instanceof Error ? e.message : "記録に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (data: {
    label: string;
    type: "motor" | "vocal";
    severity: number;
    description?: string;
    isActive?: boolean;
  }) => {
    if (editingCard) {
      await updateTicCard(editingCard.cardId, data);
      toast({
        title: "更新しました",
        description: `「${data.label}」を更新しました`,
      });
    } else {
      await createTicCard(data);
      toast({
        title: "追加しました",
        description: `「${data.label}」を追加しました`,
      });
    }
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingCard(null);
  };

  if (childrenLoading) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div>
      <div className="mb-6 space-y-2">
        <Label htmlFor="child-select">子どもを選択</Label>
        <Select
          value={selectedChildId || ""}
          onValueChange={(v) => setSelectedChildId(v || null)}
        >
          <SelectTrigger id="child-select" className="w-full">
            <SelectValue placeholder="子どもを選択してください" />
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
          子どもを選択してください
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">チックカード</h2>
            <Button
              size="sm"
              onClick={() => {
                setEditingCard(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>

          {cardsLoading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : cardsError ? (
            <p className="text-destructive">{cardsError}</p>
          ) : ticCards.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              チックカードを追加してください
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
          もう一度タップで「{deleteConfirm.label}」を削除
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
