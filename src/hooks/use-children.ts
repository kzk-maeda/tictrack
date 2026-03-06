"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import type { Child } from "@/lib/types";

export function useChildren() {
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient<Child[]>("/children");
      setChildren(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load children");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createChild = useCallback(
    async (data: { displayName: string; birthYearMonth: string }) => {
      const child = await apiClient<Child>("/children", {
        method: "POST",
        body: data,
      });
      setChildren((prev) => [...prev, child]);
      return child;
    },
    [],
  );

  const updateChild = useCallback(
    async (
      childId: string,
      data: { displayName?: string; birthYearMonth?: string },
    ) => {
      const updated = await apiClient<Child>(`/children/${childId}`, {
        method: "PUT",
        body: data,
      });
      setChildren((prev) =>
        prev.map((c) => (c.childId === childId ? updated : c)),
      );
      return updated;
    },
    [],
  );

  const deleteChild = useCallback(async (childId: string) => {
    await apiClient(`/children/${childId}`, { method: "DELETE" });
    setChildren((prev) => prev.filter((c) => c.childId !== childId));
  }, []);

  return { children, isLoading, error, createChild, updateChild, deleteChild, refresh };
}
