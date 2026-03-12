"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { apiClient } from "@/lib/api";
import type { Child } from "@/lib/types";

export function useChildren() {
  const { data, error, isLoading, mutate } = useSWR<Child[]>(
    "/children",
    async (url) => apiClient<Child[]>(url),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000, // Cache for 5 seconds
    }
  );

  const children = data || [];

  const createChild = useCallback(
    async (data: { displayName: string; birthYearMonth: string }) => {
      const child = await apiClient<Child>("/children", {
        method: "POST",
        body: data,
      });

      // Optimistic update
      await mutate([...children, child], false);

      return child;
    },
    [children, mutate],
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

      // Optimistic update
      await mutate(
        children.map((c) => (c.childId === childId ? updated : c)),
        false
      );

      return updated;
    },
    [children, mutate],
  );

  const deleteChild = useCallback(
    async (childId: string) => {
      await apiClient(`/children/${childId}`, { method: "DELETE" });

      // Optimistic update
      await mutate(
        children.filter((c) => c.childId !== childId),
        false
      );
    },
    [children, mutate],
  );

  const setDefaultChild = useCallback(
    async (childId: string) => {
      const updated = await apiClient<Child>(`/children/${childId}/set-default`, {
        method: "POST",
      });

      // Refresh all children to update isDefault flags
      await mutate();

      return updated;
    },
    [mutate],
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    children,
    isLoading,
    error: error ? error.message : null,
    createChild,
    updateChild,
    deleteChild,
    setDefaultChild,
    refresh
  };
}
