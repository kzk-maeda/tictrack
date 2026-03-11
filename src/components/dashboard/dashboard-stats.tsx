"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Calendar, TrendingUp, PieChart } from "lucide-react";
import type { DashboardData } from "@/lib/types";

interface DashboardStatsProps {
  data: DashboardData;
  period: "7" | "30" | "custom";
}

export function DashboardStats({ data, period }: DashboardStatsProps) {
  const t = useTranslations("dashboard");

  const stats = [
    {
      title: t("totalEpisodes"),
      value: data.basicStats.totalEpisodes,
      icon: Activity,
      description: t("totalEpisodesDesc"),
    },
    {
      title: t("recordedDays"),
      value: `${data.basicStats.recordedDays}/${parseInt(period)}`,
      icon: Calendar,
      description: t("dataCompleteness", {
        completeness: data.basicStats.dataCompleteness,
      }),
    },
    {
      title: t("avgPerDay"),
      value: data.basicStats.avgPerRecordedDay.toFixed(1),
      icon: TrendingUp,
      description: t("avgPerDayDesc"),
    },
    {
      title: t("mostFrequent"),
      value: data.mostFrequentTics[0]?.symptom || "-",
      valueClass: "text-xl",
      icon: PieChart,
      description: data.mostFrequentTics[0]
        ? t("timesRecorded", { count: data.mostFrequentTics[0].count })
        : t("noData"),
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={stat.valueClass || "text-2xl font-bold"}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
