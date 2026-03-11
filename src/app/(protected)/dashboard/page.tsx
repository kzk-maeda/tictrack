"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart3, PieChart, TrendingUp } from "lucide-react";
import { useChildren } from "@/hooks/use-children";
import { useDashboard } from "@/hooks/use-dashboard";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tChildren = useTranslations("children");
  const tCommon = useTranslations("common");

  const { children, isLoading: childrenLoading } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7" | "30" | "custom">("7");

  // Auto-select default child when children load
  useEffect(() => {
    if (!childrenLoading && children.length > 0 && !selectedChildId) {
      const defaultChild = children.find((c) => c.isDefault);
      if (defaultChild) {
        setSelectedChildId(defaultChild.childId);
      } else {
        // Fallback to first child if no default
        setSelectedChildId(children[0].childId);
      }
    }
  }, [children, childrenLoading, selectedChildId]);

  // Calculate date range based on period
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    if (period === "7") {
      start.setDate(start.getDate() - 6); // 7 days including today
    } else if (period === "30") {
      start.setDate(start.getDate() - 29); // 30 days including today
    }
    start.setHours(0, 0, 0, 0);

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, [period]);

  const { data, isLoading, error } = useDashboard(
    selectedChildId,
    startDate,
    endDate
  );

  if (childrenLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-4">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Child Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="child-select-dashboard">
                {tChildren("selectChild")}
              </Label>
              <Select
                value={selectedChildId || ""}
                onValueChange={(v) => setSelectedChildId(v || null)}
              >
                <SelectTrigger id="child-select-dashboard" className="w-full">
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

            {/* Period Selector */}
            {selectedChildId && (
              <div>
                <Label htmlFor="period-select">{t("periodLabel")}</Label>
                <div className="flex gap-2">
                  <Button
                    variant={period === "7" ? "default" : "outline"}
                    onClick={() => setPeriod("7")}
                    className="flex-1"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {t("period7days")}
                  </Button>
                  <Button
                    variant={period === "30" ? "default" : "outline"}
                    onClick={() => setPeriod("30")}
                    className="flex-1"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {t("period30days")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Content */}
      {!selectedChildId ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              {tChildren("selectPlaceholder")}
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              {tCommon("loading")}
            </p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive py-8">
              {error instanceof Error ? error.message : tCommon("error")}
            </p>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          {/* Stats Cards */}
          <DashboardStats data={data} period={period} />

          {/* Charts */}
          <DashboardCharts data={data} />
        </>
      ) : null}
    </div>
  );
}
