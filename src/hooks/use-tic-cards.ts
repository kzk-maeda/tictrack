"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import type { TicCard } from "@/lib/types";

export function useTicCards(childId: string | null) {
  const [ticCards, setTicCards] = useState<TicCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!childId) {
      setTicCards([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient<TicCard[]>(`/children/${childId}/tic-cards`);
      setTicCards(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tic cards");
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      setTicCards((prev) => [...prev, card]);
      return card;
    },
    [childId],
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
      setTicCards((prev) =>
        prev.map((c) => (c.cardId === cardId ? updated : c)),
      );
      return updated;
    },
    [childId],
  );

  const deleteTicCard = useCallback(
    async (cardId: string) => {
      if (!childId) throw new Error("No child selected");
      await apiClient(`/children/${childId}/tic-cards/${cardId}`, {
        method: "DELETE",
      });
      setTicCards((prev) => prev.filter((c) => c.cardId !== cardId));
    },
    [childId],
  );

  return {
    ticCards,
    isLoading,
    error,
    createTicCard,
    updateTicCard,
    deleteTicCard,
    refresh,
  };
}
