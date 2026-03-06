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
import type { Child } from "@/lib/types";

interface ChildFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child?: Child | null;
  onSubmit: (data: { displayName: string; birthYearMonth: string }) => Promise<void>;
}

export function ChildForm({ open, onOpenChange, child, onSubmit }: ChildFormProps) {
  const [displayName, setDisplayName] = useState(child?.displayName || "");
  const [birthYearMonth, setBirthYearMonth] = useState(child?.birthYearMonth || "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!child;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError("名前を入力してください");
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(birthYearMonth)) {
      setError("生年月はYYYY-MM形式で入力してください");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({ displayName: displayName.trim(), birthYearMonth });
      onOpenChange(false);
      setDisplayName("");
      setBirthYearMonth("");
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
          <DialogTitle>{isEditing ? "子ども情報を編集" : "子どもを追加"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">名前</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例: タロウ"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthYearMonth">生年月</Label>
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
