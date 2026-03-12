"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { apiClient } from "@/lib/api";
import type { Episode } from "@/lib/types";

export function useEpisodes(childId: string | null) {
  // Get last 30 days of episodes
  const { from, to } = useMemo(() => {
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  }, []);

  const url = childId
    ? `/children/${childId}/episodes?from=${from}&to=${to}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<Episode[]>(
    url,
    async (url) => apiClient<Episode[]>(url),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const episodes = data || [];

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

      // Optimistic update (prepend new episode)
      await mutate([episode, ...episodes], false);

      return episode;
    },
    [childId, episodes, mutate],
  );

  const getVideoUrl = useCallback(
    async (episodeId: string) => {
      if (!childId) throw new Error("No child selected");
      const data = await apiClient<{ url: string }>(
        `/children/${childId}/episodes/${episodeId}/video-url`,
      );
      return data.url;
    },
    [childId],
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  return { episodes, isLoading, error: error ? error.message : null, createEpisode, getVideoUrl, refresh };
}
