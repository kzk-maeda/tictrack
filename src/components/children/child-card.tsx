"use client";

import { Pencil, Trash2, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Child } from "@/lib/types";

interface ChildCardProps {
  child: Child;
  onEdit: (child: Child) => void;
  onDelete: (child: Child) => void;
  onToggleDefault: (child: Child) => void;
}

export function ChildCard({ child, onEdit, onDelete, onToggleDefault }: ChildCardProps) {
  const t = useTranslations("children");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleDefault(child)}
            title={child.isDefault ? "デフォルト" : "デフォルトに設定"}
          >
            <Star
              className={`h-5 w-5 ${child.isDefault ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
            />
          </Button>
          <CardTitle className="text-lg">{child.displayName}</CardTitle>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(child)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(child)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t("birthYearMonth")}: {child.birthYearMonth}
        </p>
      </CardContent>
    </Card>
  );
}
