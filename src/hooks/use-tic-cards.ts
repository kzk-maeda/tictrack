"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { apiClient } from "@/lib/api";
import type { TicCard } from "@/lib/types";

export function useTicCards(childId: string | null) {
  const url = childId ? `/children/${childId}/tic-cards` : null;

  const { data, error, isLoading, mutate } = useSWR<TicCard[]>(
    url,
    async (url) => apiClient<TicCard[]>(url),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const ticCards = data || [];

  const createTicCard = useCallback(
    async (data: {
      type: "motor" | "vocal";
      complexity: "simple" | "complex";
      symptomId?: string;
      customSymptom?: string;
      severity: number;
      description?: string;
      // Legacy field for backward compatibility
      label?: string;
    }) => {
      if (!childId) throw new Error("No child selected");
      const card = await apiClient<TicCard>(`/children/${childId}/tic-cards`, {
        method: "POST",
        body: data,
      });

      // Optimistic update
      await mutate([...ticCards, card], false);

      return card;
    },
    [childId, ticCards, mutate],
  );

  const updateTicCard = useCallback(
    async (
      cardId: string,
      data: {
        type?: "motor" | "vocal";
        complexity?: "simple" | "complex";
        symptomId?: string;
        customSymptom?: string;
        severity?: number;
        description?: string;
        isActive?: boolean;
        // Legacy field for backward compatibility
        label?: string;
      },
    ) => {
      if (!childId) throw new Error("No child selected");
      const updated = await apiClient<TicCard>(
        `/children/${childId}/tic-cards/${cardId}`,
        {
          method: "PUT",
          body: data,
        },
      );

      // Optimistic update
      await mutate(
        ticCards.map((c) => (c.cardId === cardId ? updated : c)),
        false
      );

      return updated;
    },
    [childId, ticCards, mutate],
  );

  const deleteTicCard = useCallback(
    async (cardId: string) => {
      if (!childId) throw new Error("No child selected");
      await apiClient(`/children/${childId}/tic-cards/${cardId}`, {
        method: "DELETE",
      });

      // Optimistic update
      await mutate(
        ticCards.filter((c) => c.cardId !== cardId),
        false
      );
    },
    [childId, ticCards, mutate],
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    ticCards,
    isLoading,
    error: error ? error.message : null,
    createTicCard,
    updateTicCard,
    deleteTicCard,
    refresh,
  };
}
