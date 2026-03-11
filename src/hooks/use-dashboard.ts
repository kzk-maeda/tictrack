"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";
import type { DashboardData } from "@/lib/types";

export function useDashboard(
  childId: string | null,
  startDate?: string,
  endDate?: string
) {
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set("start", startDate);
  if (endDate) queryParams.set("end", endDate);
  const queryString = queryParams.toString();

  const url = childId
    ? `/children/${childId}/dashboard${queryString ? `?${queryString}` : ""}`
    : null;

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<DashboardData>(
    url,
    async (url) => apiClient<DashboardData>(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Cache for 30 seconds
    }
  );

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  };
}
