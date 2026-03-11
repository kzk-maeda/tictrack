"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
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
  const [deletingChild, setDeletingChild] = useState<Child | null>(null);

  const handleEdit = (child: Child) => {
    setEditingChild(child);
    setFormOpen(true);
  };

  const handleDelete = (child: Child) => {
    setDeletingChild(child);
  };

  const handleConfirmDelete = async () => {
    if (deletingChild) {
      await deleteChild(deletingChild.childId);
      setDeletingChild(null);
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

      <DeleteConfirmationDialog
        open={!!deletingChild}
        onOpenChange={(open) => !open && setDeletingChild(null)}
        onConfirm={handleConfirmDelete}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", {
          name: deletingChild?.displayName || "",
        })}
        relatedData={[
          t("deleteRelatedTicCards"),
          t("deleteRelatedEpisodes"),
          t("deleteRelatedMedications"),
          t("deleteRelatedLifeEvents"),
        ]}
      />

      <ChildForm
        open={formOpen}
        onOpenChange={handleFormClose}
        child={editingChild}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
