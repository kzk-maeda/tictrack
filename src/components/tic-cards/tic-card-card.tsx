"use client";

import { Pencil, Trash2, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TicCard } from "@/lib/types";

interface TicCardCardProps {
  card: TicCard;
  onEdit: (card: TicCard) => void;
  onDelete: (card: TicCard) => void;
  onQuickLog: (card: TicCard) => void;
}

export function TicCardCard({
  card,
  onEdit,
  onDelete,
  onQuickLog,
}: TicCardCardProps) {
  const t = useTranslations("ticCards");
  const tForm = useTranslations("ticCards.form");

  const typeLabel = card.type === "motor" ? tForm("typeMotor") : tForm("typeVocal");
  const severityLabel = [tForm("severityMild"), tForm("severityModerate"), tForm("severitySevere")][card.severity - 1] || "";

  return (
    <Card className={card.isActive ? "" : "opacity-50"}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{card.label}</CardTitle>
          {!card.isActive && (
            <Badge variant="outline" className="text-xs">
              {t("inactive")}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="default"
            size="sm"
            onClick={() => onQuickLog(card)}
            disabled={!card.isActive}
            className="gap-1"
          >
            <Zap className="h-3 w-3" />
            {t("quickLog")}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(card)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(card)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-2">
          <Badge variant="secondary">{typeLabel}</Badge>
          <Badge variant="outline">{severityLabel}</Badge>
        </div>
        {card.description && (
          <p className="text-sm text-muted-foreground">{card.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
