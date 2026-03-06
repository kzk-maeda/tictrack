"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ChildCard } from "./child-card";
import { ChildForm } from "./child-form";
import { useChildren } from "@/hooks/use-children";
import type { Child } from "@/lib/types";

export function ChildrenList() {
  const t = useTranslations("children");
  const tCommon = useTranslations("common");
  const { children, isLoading, error, createChild, updateChild, deleteChild, setDefaultChild } =
    useChildren();
  const [formOpen, setFormOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Child | null>(null);

  const handleEdit = (child: Child) => {
    setEditingChild(child);
    setFormOpen(true);
  };

  const handleDelete = async (child: Child) => {
    if (deleteConfirm?.childId === child.childId) {
      await deleteChild(child.childId);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(child);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleToggleDefault = async (child: Child) => {
    await setDefaultChild(child.childId);
  };

  const handleSubmit = async (data: {
    displayName: string;
    birthYearMonth: string;
  }) => {
    if (editingChild) {
      await updateChild(editingChild.childId, data);
    } else {
      await createChild(data);
    }
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingChild(null);
  };

  if (isLoading) {
    return <p className="text-muted-foreground">{tCommon("loading")}</p>;
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingChild(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("add")}
        </Button>
      </div>

      {children.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {t("noChildren")}
        </p>
      ) : (
        <div className="space-y-3">
          {children.map((child) => (
            <ChildCard
              key={child.childId}
              child={child}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleDefault={handleToggleDefault}
            />
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-md text-sm">
          {t("deleteConfirm", { name: deleteConfirm.displayName })}
        </div>
      )}

      <ChildForm
        open={formOpen}
        onOpenChange={handleFormClose}
        child={editingChild}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
