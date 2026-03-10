import type { MedicationType } from "./types";

export interface MedicationMaster {
  id: string;
  nameJa: string;
  nameEn: string;
  brandNameJa?: string;
  brandNameEn?: string;
  type: MedicationType;
  commonDosages: number[];  // Common dosages in mg
  displayOrder: number;
  isAvailable: boolean;     // false for discontinued drugs
}

export const MEDICATION_MASTER: MedicationMaster[] = [
  // 抗精神病薬 (Antipsychotics)
  {
    id: "aripiprazole",
    nameJa: "アリピプラゾール",
    nameEn: "Aripiprazole",
    brandNameJa: "エビリファイ",
    brandNameEn: "Abilify",
    type: "antipsychotic",
    commonDosages: [3, 6, 12],
    displayOrder: 1,
    isAvailable: true,
  },
  {
    id: "risperidone",
    nameJa: "リスペリドン",
    nameEn: "Risperidone",
    brandNameJa: "リスパダール",
    brandNameEn: "Risperdal",
    type: "antipsychotic",
    commonDosages: [0.5, 1, 2, 3],
    displayOrder: 2,
    isAvailable: true,
  },
  {
    id: "olanzapine",
    nameJa: "オランザピン",
    nameEn: "Olanzapine",
    brandNameJa: "ジプレキサ",
    brandNameEn: "Zyprexa",
    type: "antipsychotic",
    commonDosages: [2.5, 5, 10],
    displayOrder: 3,
    isAvailable: true,
  },
  {
    id: "haloperidol",
    nameJa: "ハロペリドール",
    nameEn: "Haloperidol",
    brandNameJa: "セレネース",
    brandNameEn: "Haldol",
    type: "antipsychotic",
    commonDosages: [0.75, 1.5, 3],
    displayOrder: 4,
    isAvailable: true,
  },
  {
    id: "quetiapine",
    nameJa: "クエチアピン",
    nameEn: "Quetiapine",
    brandNameJa: "セロクエル",
    brandNameEn: "Seroquel",
    type: "antipsychotic",
    commonDosages: [25, 50, 100, 200],
    displayOrder: 5,
    isAvailable: true,
  },
  {
    id: "pimozide",
    nameJa: "ピモジド",
    nameEn: "Pimozide",
    brandNameJa: "オーラップ",
    brandNameEn: "Orap",
    type: "antipsychotic",
    commonDosages: [1, 2],
    displayOrder: 6,
    isAvailable: false,  // 販売中止
  },

  // α2アドレナリン受容体作動薬 (Alpha-2 Adrenergic Agonists)
  {
    id: "clonidine",
    nameJa: "クロニジン",
    nameEn: "Clonidine",
    brandNameJa: "カタプレス",
    brandNameEn: "Catapres",
    type: "alpha2_agonist",
    commonDosages: [0.075, 0.15],
    displayOrder: 7,
    isAvailable: true,
  },
];

export function getMedicationById(id: string): MedicationMaster | undefined {
  return MEDICATION_MASTER.find((med) => med.id === id);
}

export function getAvailableMedications(): MedicationMaster[] {
  return MEDICATION_MASTER.filter((med) => med.isAvailable).sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
}

export function getMedicationDisplayName(
  medication: MedicationMaster,
  locale: string = "ja"
): string {
  const name = locale === "ja" ? medication.nameJa : medication.nameEn;
  const brandName = locale === "ja" ? medication.brandNameJa : medication.brandNameEn;
  return brandName ? `${name} (${brandName})` : name;
}
