"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DashboardData } from "@/lib/types";

interface DashboardChartsProps {
  data: DashboardData;
}

const COLORS = {
  motor: "#3b82f6", // blue-500
  vocal: "#8b5cf6", // violet-500
  both: "#ec4899", // pink-500
  severity1: "#22c55e", // green-500
  severity2: "#f59e0b", // amber-500
  severity3: "#ef4444", // red-500
};

export function DashboardCharts({ data }: DashboardChartsProps) {
  const t = useTranslations("dashboard");

  // Prepare type distribution data
  const typeData = [
    { name: t("typeMotor"), value: data.typeDistribution.motor, color: COLORS.motor },
    { name: t("typeVocal"), value: data.typeDistribution.vocal, color: COLORS.vocal },
    { name: t("typeBoth"), value: data.typeDistribution.both, color: COLORS.both },
  ].filter((item) => item.value > 0);

  // Prepare severity distribution data
  const severityData = [
    {
      name: t("severity1"),
      value: data.severityDistribution["1"],
      fill: COLORS.severity1,
    },
    {
      name: t("severity2"),
      value: data.severityDistribution["2"],
      fill: COLORS.severity2,
    },
    {
      name: t("severity3"),
      value: data.severityDistribution["3"],
      fill: COLORS.severity3,
    },
  ];

  // Prepare time pattern data
  const timeData = [
    { time: "06-12", label: t("time0612"), value: data.timePattern["06-12"] },
    { time: "12-18", label: t("time1218"), value: data.timePattern["12-18"] },
    { time: "18-22", label: t("time1822"), value: data.timePattern["18-22"] },
    { time: "22-06", label: t("time2206"), value: data.timePattern["22-06"] },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Type Distribution (Pie Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("typeDistribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {t("noData")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Severity Distribution (Bar Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("severityDistribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={severityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Time Pattern (Line Chart) */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>
            {t("timePattern")}
            {data.timePattern.peakTime && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({t("peakTime")}: {data.timePattern.peakTime})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                name={t("episodeCount")}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Most Frequent Tics (Table) */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{t("mostFrequentTics")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.mostFrequentTics.length > 0 ? (
            <div className="space-y-2">
              {data.mostFrequentTics.map((tic, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <span className="font-medium">{tic.symptom}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {t("timesRecorded", { count: tic.count })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {t("noData")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
