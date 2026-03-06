"use client";

import { useState } from "react";
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
      setError("ラベルを入力してください");
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
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "チックカードを編集" : "チックカードを追加"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">ラベル</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="例: 首振り"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">種類</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "motor" | "vocal")}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="motor">運動性</SelectItem>
                  <SelectItem value="vocal">音声性</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">強度</Label>
              <Select
                value={severity.toString()}
                onValueChange={(v) => setSeverity(parseInt(v, 10))}
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">軽度</SelectItem>
                  <SelectItem value="2">中度</SelectItem>
                  <SelectItem value="3">重度</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">説明（任意）</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: 左右に首を振る"
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
                  アクティブ
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
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : isEditing ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
