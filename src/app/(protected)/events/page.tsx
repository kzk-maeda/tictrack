"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Video, Pill, CalendarDays } from "lucide-react";
import { TicCardsList } from "@/components/tic-cards/tic-cards-list";
import { MedicationsList } from "@/components/medications/medications-list";
import { LifeEventsList } from "@/components/life-events/life-events-list";

export default function EventsPage() {
  const t = useTranslations("events");
  const tTabs = useTranslations("events.tabs");

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
          <div className="text-center py-12 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Video input feature coming soon...</p>
            <p className="text-sm mt-2">
              For now, videos can be uploaded from the timeline when creating episodes.
            </p>
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
