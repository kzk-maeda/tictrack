"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Timeline } from "@/components/timeline/timeline";
import { useChildren } from "@/hooks/use-children";

export default function TimelinePage() {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const { children } = useChildren();
  const t = useTranslations("timeline");

  // Auto-select default child if no child is selected
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      const defaultChild = children.find((c) => c.isDefault);
      if (defaultChild) {
        setSelectedChildId(defaultChild.childId);
      }
    }
  }, [selectedChildId, children]);

  return (
    <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
      <Timeline
        selectedChildId={selectedChildId}
        onSelectChild={setSelectedChildId}
      />
    </div>
  );
}
