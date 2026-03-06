"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import type { Episode } from "@/lib/types";

export function useEpisodes(childId: string | null) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!childId) {
      setEpisodes([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get last 30 days of episodes
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const data = await apiClient<Episode[]>(
        `/children/${childId}/episodes?from=${from}&to=${to}`,
      );
      setEpisodes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load episodes");
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createEpisode = useCallback(
    async (data: {
      recordType: "video" | "quick_log";
      ticCardId?: string;
      occurredAt: string;
      context?: string;
      notes?: string;
    }) => {
      if (!childId) throw new Error("No child selected");
      const episode = await apiClient<Episode>(`/children/${childId}/episodes`, {
        method: "POST",
        body: data,
      });
      setEpisodes((prev) => [episode, ...prev]);
      return episode;
    },
    [childId],
  );

  return { episodes, isLoading, error, createEpisode, refresh };
}
