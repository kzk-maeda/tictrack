"use client";

import useSWR from "swr";
import { useCallback } from "react";
import * as api from "@/lib/api";
import type { LifeEvent } from "@/lib/types";

export function useLifeEvents(childId: string | null) {
  const url = childId ? `/children/${childId}/life-events` : null;

  const { data, error, isLoading, mutate } = useSWR<LifeEvent[]>(
    url,
    async () => (childId ? api.listLifeEvents(childId) : []),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const lifeEvents = data || [];

  const addLifeEvent = useCallback(
    async (request: Omit<LifeEvent, "eventId" | "createdAt" | "updatedAt">) => {
      if (!childId) throw new Error("No child selected");

      const newEvent = await api.createLifeEvent(childId, request);

      // Optimistic update (prepend new event)
      await mutate([newEvent, ...lifeEvents], false);

      return newEvent;
    },
    [childId, lifeEvents, mutate]
  );

  const updateLifeEvent = useCallback(
    async (
      eventId: string,
      request: Partial<Omit<LifeEvent, "eventId" | "childId" | "createdAt" | "updatedAt">>
    ) => {
      const updated = await api.updateLifeEvent(eventId, request);

      // Optimistic update
      await mutate(
        lifeEvents.map((e) => (e.eventId === eventId ? updated : e)),
        false
      );

      return updated;
    },
    [lifeEvents, mutate]
  );

  const removeLifeEvent = useCallback(
    async (eventId: string) => {
      await api.deleteLifeEvent(eventId);

      // Optimistic update
      await mutate(
        lifeEvents.filter((e) => e.eventId !== eventId),
        false
      );
    },
    [lifeEvents, mutate]
  );

  return {
    lifeEvents,
    isLoading,
    error,
    addLifeEvent,
    updateLifeEvent,
    removeLifeEvent,
  };
}
