import { useState, useEffect } from "react";
import * as api from "@/lib/api";
import type { LifeEvent } from "@/lib/types";

export function useLifeEvents(childId: string | null) {
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch life events when childId changes
  useEffect(() => {
    if (!childId) {
      setLifeEvents([]);
      return;
    }

    const fetchLifeEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const events = await api.listLifeEvents(childId);
        setLifeEvents(events);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch life events"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchLifeEvents();
  }, [childId]);

  const addLifeEvent = async (request: Omit<LifeEvent, "eventId" | "createdAt" | "updatedAt">) => {
    if (!childId) throw new Error("No child selected");

    const newEvent = await api.createLifeEvent(childId, request);
    setLifeEvents((prev) => [newEvent, ...prev]);
    return newEvent;
  };

  const updateLifeEvent = async (
    eventId: string,
    request: Partial<Omit<LifeEvent, "eventId" | "childId" | "createdAt" | "updatedAt">>
  ) => {
    const updated = await api.updateLifeEvent(eventId, request);
    setLifeEvents((prev) => prev.map((e) => (e.eventId === eventId ? updated : e)));
    return updated;
  };

  const removeLifeEvent = async (eventId: string) => {
    await api.deleteLifeEvent(eventId);
    setLifeEvents((prev) => prev.filter((e) => e.eventId !== eventId));
  };

  return {
    lifeEvents,
    isLoading,
    error,
    addLifeEvent,
    updateLifeEvent,
    removeLifeEvent,
  };
}
