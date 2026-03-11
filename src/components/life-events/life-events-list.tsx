"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { LifeEventCard } from "./life-event-card";
import { LifeEventForm } from "./life-event-form";
import { useLifeEvents } from "@/hooks/use-life-events";
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
import type { LifeEvent } from "@/lib/types";

export function LifeEventsList() {
  const t = useTranslations("lifeEvents");
  const tChildren = useTranslations("children");
  const tCommon = useTranslations("common");
  const { toast } = useToast();

  const { children } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const {
    lifeEvents,
    isLoading,
    error,
    addLifeEvent,
    updateLifeEvent,
    removeLifeEvent,
  } = useLifeEvents(selectedChildId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);

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
    setEditingEvent(null);
    setIsFormOpen(true);
  };

  const handleEdit = (event: LifeEvent) => {
    setEditingEvent(event);
    setIsFormOpen(true);
  };

  const handleSubmit = async (request: any) => {
    try {
      if (editingEvent) {
        await updateLifeEvent(editingEvent.eventId, request);
        toast({
          title: t("toast.updated"),
          description: t("toast.updatedDescription", { title: request.title }),
        });
      } else {
        await addLifeEvent(request);
        toast({
          title: t("toast.created"),
          description: t("toast.createdDescription", { title: request.title }),
        });
      }
      setIsFormOpen(false);
      setEditingEvent(null);
    } catch (error) {
      throw error;
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await removeLifeEvent(eventId);
      toast({
        title: t("toast.deleted"),
        description: t("toast.deletedDescription", {
          title: lifeEvents.find((e) => e.eventId === eventId)?.title || "",
        }),
      });
    } catch (error) {
      toast({
        title: t("toast.error"),
        description: t("toast.errorDescription"),
        variant: "destructive",
      });
    }
  };

  if (isFormOpen) {
    return (
      <LifeEventForm
        event={editingEvent || undefined}
        onSubmit={handleSubmit}
        onCancel={() => {
          setIsFormOpen(false);
          setEditingEvent(null);
        }}
      />
    );
  }

  return (
    <div>
      {/* Child Selector */}
      {children.length > 1 && (
        <div className="mb-6">
          <Label htmlFor="child-selector">{tChildren("selectChild")}</Label>
          <Select value={selectedChildId || ""} onValueChange={setSelectedChildId}>
            <SelectTrigger id="child-selector" className="w-full">
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
      )}

      {!selectedChildId && children.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{tChildren("noChildren")}</p>
        </div>
      ) : !selectedChildId ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{tChildren("selectPlaceholder")}</p>
        </div>
      ) : (
        <>
          {/* Add Button */}
          <div className="flex justify-between items-center mb-4">
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("add")}
            </Button>
          </div>

          {/* Loading / Error States */}
          {isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              {tCommon("loading")}
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-destructive">
              {tCommon("error")}
            </div>
          )}

          {/* Life Events List */}
          {!isLoading && !error && lifeEvents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t("noEvents")}</p>
            </div>
          )}

          {!isLoading && !error && lifeEvents.length > 0 && (
            <div className="space-y-4">
              {lifeEvents.map((event) => (
                <LifeEventCard
                  key={event.eventId}
                  event={event}
                  onEdit={handleEdit}
                  onDelete={() => handleDelete(event.eventId)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
