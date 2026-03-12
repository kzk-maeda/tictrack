"use client";

import useSWR from "swr";
import { useCallback } from "react";
import {
  listMedicationCards,
  createMedicationCard,
  updateMedicationCard,
  deleteMedicationCard,
  createMedicationLog,
  type MedicationCardResponse,
  type CreateMedicationCardRequest,
  type UpdateMedicationCardRequest,
  type CreateMedicationLogRequest,
} from "@/lib/api";

export function useMedications(childId: string | null) {
  const url = childId ? `/children/${childId}/medications` : null;

  const { data, error, isLoading, mutate } = useSWR<MedicationCardResponse[]>(
    url,
    async () => (childId ? listMedicationCards(childId) : []),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const medications = data || [];

  const addMedication = useCallback(
    async (request: CreateMedicationCardRequest) => {
      if (!childId) throw new Error("No child selected");

      const newMedication = await createMedicationCard(childId, request);

      // Optimistic update
      await mutate([...medications, newMedication], false);

      return newMedication;
    },
    [childId, medications, mutate]
  );

  const updateMedication = useCallback(
    async (medicationId: string, request: UpdateMedicationCardRequest) => {
      if (!childId) throw new Error("No child selected");

      const updated = await updateMedicationCard(childId, medicationId, request);

      // Optimistic update
      await mutate(
        medications.map((m) => (m.medicationId === medicationId ? updated : m)),
        false
      );

      return updated;
    },
    [childId, medications, mutate]
  );

  const removeMedication = useCallback(
    async (medicationId: string) => {
      if (!childId) throw new Error("No child selected");

      await deleteMedicationCard(childId, medicationId);

      // Optimistic update
      await mutate(
        medications.filter((m) => m.medicationId !== medicationId),
        false
      );
    },
    [childId, medications, mutate]
  );

  const logMedication = useCallback(
    async (medicationId: string, request: CreateMedicationLogRequest = {}) => {
      if (!childId) throw new Error("No child selected");

      return await createMedicationLog(childId, medicationId, request);
    },
    [childId]
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    medications,
    isLoading,
    error: error ? error.message : null,
    addMedication,
    updateMedication,
    removeMedication,
    logMedication,
    refresh,
  };
}
