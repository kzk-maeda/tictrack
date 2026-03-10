"use client";

import { useState, ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TimelineCardProps {
  icon: ReactNode;
  title: string | ReactNode;
  time: string;
  badge?: ReactNode;
  onDelete?: () => Promise<void>;
  children?: ReactNode;
  className?: string;
}

export function TimelineCard({
  icon,
  title,
  time,
  badge,
  onDelete,
  children,
  className,
}: TimelineCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {typeof title === "string" ? (
                <span className="text-sm font-medium">{title}</span>
              ) : (
                title
              )}
              {badge && <div className="flex items-center gap-1">{badge}</div>}
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>
            {children}
          </div>
          {onDelete && (
            <Button
              variant={confirmDelete ? "destructive" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
