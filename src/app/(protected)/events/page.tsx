"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CreditCard, Video, Pill, CalendarDays } from "lucide-react";
import { TicCardsList } from "@/components/tic-cards/tic-cards-list";
import { MedicationsList } from "@/components/medications/medications-list";
import { LifeEventsList } from "@/components/life-events/life-events-list";
import { useChildren } from "@/hooks/use-children";
import { apiClient } from "@/lib/api";
import type { Episode } from "@/lib/types";

export default function EventsPage() {
  const t = useTranslations("events");
  const tTabs = useTranslations("events.tabs");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const { children } = useChildren();

  const handleRecordVideo = async () => {
    // Get default child or first child
    const defaultChild = children.find((c) => c.isDefault) || children[0];
    if (!defaultChild) {
      return;
    }

    try {
      // Create a new episode first
      const episode = await apiClient<Episode>(`/children/${defaultChild.childId}/episodes`, {
        method: "POST",
        body: {
          recordType: "video",
          occurredAt: new Date().toISOString(),
        },
      });

      // Navigate to capture page with childId and episodeId
      router.push(`/capture?childId=${defaultChild.childId}&episodeId=${episode.episodeId}`);
    } catch (error) {
      console.error("Failed to create episode:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="ticCards" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="ticCards" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">{tTabs("ticCards")}</span>
          </TabsTrigger>
          <TabsTrigger value="videoInput" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">{tTabs("videoInput")}</span>
          </TabsTrigger>
          <TabsTrigger value="medications" className="flex items-center gap-2">
            <Pill className="h-4 w-4" />
            <span className="hidden sm:inline">{tTabs("medications")}</span>
          </TabsTrigger>
          <TabsTrigger value="lifeEvents" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">{tTabs("lifeEvents")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ticCards">
          <TicCardsList />
        </TabsContent>

        <TabsContent value="videoInput">
          <div className="text-center py-12">
            <Video className="h-16 w-16 mx-auto mb-6 text-primary" />
            <h3 className="text-xl font-semibold mb-3">{tTabs("videoInput")}</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              動画でチック症状を記録すると、AIが自動的に分析してラベル付けします
            </p>
            <Button
              size="lg"
              onClick={handleRecordVideo}
              className="gap-2"
              disabled={children.length === 0}
            >
              <Video className="h-5 w-5" />
              {tNav("recordVideo")}
            </Button>
            {children.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                動画を撮影するには、まず子どもを追加してください
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="medications">
          <MedicationsList />
        </TabsContent>

        <TabsContent value="lifeEvents">
          <LifeEventsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
