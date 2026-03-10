"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [medications, setMedications] = useState<MedicationCardResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMedications = useCallback(async () => {
    if (!childId) {
      setMedications([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await listMedicationCards(childId);
      setMedications(data);
    } catch (err) {
      console.error("Failed to fetch medications:", err);
      setError(err instanceof Error ? err.message : "Failed to load medications");
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  const addMedication = useCallback(
    async (request: CreateMedicationCardRequest) => {
      if (!childId) throw new Error("No child selected");

      const newMedication = await createMedicationCard(childId, request);
      setMedications((prev) => [...prev, newMedication]);
      return newMedication;
    },
    [childId]
  );

  const updateMedication = useCallback(
    async (medicationId: string, request: UpdateMedicationCardRequest) => {
      if (!childId) throw new Error("No child selected");

      const updated = await updateMedicationCard(childId, medicationId, request);
      setMedications((prev) =>
        prev.map((m) => (m.medicationId === medicationId ? updated : m))
      );
      return updated;
    },
    [childId]
  );

  const removeMedication = useCallback(
    async (medicationId: string) => {
      if (!childId) throw new Error("No child selected");

      await deleteMedicationCard(childId, medicationId);
      setMedications((prev) => prev.filter((m) => m.medicationId !== medicationId));
    },
    [childId]
  );

  const logMedication = useCallback(
    async (medicationId: string, request: CreateMedicationLogRequest = {}) => {
      if (!childId) throw new Error("No child selected");

      return await createMedicationLog(childId, medicationId, request);
    },
    [childId]
  );

  return {
    medications,
    isLoading,
    error,
    addMedication,
    updateMedication,
    removeMedication,
    logMedication,
    refresh: fetchMedications,
  };
}
