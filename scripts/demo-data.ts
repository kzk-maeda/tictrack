/**
 * Demo Data Definitions
 *
 * All demo data definitions in one place for easy maintenance.
 */

// Child information
export const CHILD_DATA = {
  displayName: "Adam",
  birthYearMonth: "2018-04",
  isDefault: true,
};

// Tic card definitions
export const TIC_CARDS = [
  {
    type: "motor" as const,
    complexity: "simple" as const,
    symptomId: "eye_blink",
    severity: 2,
  },
  {
    type: "motor" as const,
    complexity: "simple" as const,
    symptomId: "head_jerk",
    severity: 3,
  },
  {
    type: "motor" as const,
    complexity: "simple" as const,
    symptomId: "shoulder_shrug",
    severity: 2,
  },
  {
    type: "motor" as const,
    complexity: "simple" as const,
    symptomId: "facial_grimace",
    severity: 3,
  },
  {
    type: "motor" as const,
    complexity: "complex" as const,
    symptomId: "touching_objects",
    severity: 2,
  },
  {
    type: "vocal" as const,
    complexity: "simple" as const,
    symptomId: "throat_clear",
    severity: 3,
  },
  {
    type: "vocal" as const,
    complexity: "simple" as const,
    symptomId: "sniff",
    severity: 2,
  },
  {
    type: "vocal" as const,
    complexity: "simple" as const,
    symptomId: "cough",
    severity: 2,
  },
  {
    type: "vocal" as const,
    complexity: "complex" as const,
    symptomId: "repeating_words",
    severity: 1,
  },
  {
    type: "motor" as const,
    complexity: "complex" as const,
    customSymptom: "首を何度も回す",
    severity: 3,
  },
];

// Video episode definitions with AI labels
export const VIDEO_EPISODES = [
  {
    date: "2026-02-15T19:30:00Z",
    s3Key: "videos/demo/eye-blink-demo.mp4",
    aiLabel: {
      suggestedType: "motor" as const,
      suggestedSeverity: 2,
      suggestedContext: "home",
      confidence: 0.85,
      observations: [
        {
          timestamp: 2.5,
          description: "Rapid eye blinking observed",
          intensity: "medium" as const,
        },
        {
          timestamp: 5.1,
          description: "Frequency increased",
          intensity: "medium" as const,
        },
      ],
    },
  },
  {
    date: "2026-02-20T20:15:00Z",
    s3Key: "videos/demo/throat-clear-demo.mp4",
    aiLabel: {
      suggestedType: "vocal" as const,
      suggestedSeverity: 3,
      suggestedContext: "stress",
      confidence: 0.92,
      observations: [
        {
          timestamp: 1.2,
          description: "Throat clearing sound detected",
          intensity: "high" as const,
        },
        {
          timestamp: 3.8,
          description: "Repeated throat clearing",
          intensity: "high" as const,
        },
      ],
    },
  },
  {
    date: "2026-03-05T18:45:00Z",
    s3Key: "videos/demo/shoulder-shrug-demo.mp4",
    aiLabel: {
      suggestedType: "motor" as const,
      suggestedSeverity: 2,
      suggestedContext: "play",
      confidence: 0.78,
      observations: [
        {
          timestamp: 0.8,
          description: "Shoulder shrugging movement",
          intensity: "low" as const,
        },
        {
          timestamp: 4.5,
          description: "Repeated shoulder movement",
          intensity: "medium" as const,
        },
      ],
    },
  },
];

// Medication card definitions
export const MEDICATIONS = [
  {
    name: "リスペリドン (Risperdal)",
    type: "antipsychotic" as const,
    dosageMg: 0.5,
    frequency: "1日2回（朝・夕食後）",
    startDate: "2026-01-20",
  },
  {
    name: "グアンファシン (Intuniv)",
    type: "alpha2_agonist" as const,
    dosageMg: 1.0,
    frequency: "1日1回（就寝前）",
    startDate: "2026-01-25",
  },
];

// Life event definitions
export const LIFE_EVENTS = [
  {
    type: "graduation" as const,
    title: "保育園卒園",
    occurredAt: "2026-03-15",
    stressLevel: 4,
    notes: "小学校入学を控えて緊張している様子",
  },
  {
    type: "medical" as const,
    title: "小児神経科の初診",
    occurredAt: "2026-01-15",
    stressLevel: 3,
    notes: "チック症状について専門医に相談",
  },
  {
    type: "social" as const,
    title: "発表会",
    occurredAt: "2026-02-10",
    stressLevel: 4,
    notes: "大勢の前での発表で緊張",
  },
  {
    type: "family_change" as const,
    title: "妹が生まれる",
    occurredAt: "2026-01-30",
    stressLevel: 2,
    notes: "家族構成の変化",
  },
];

// Episode generation settings
export const EPISODE_SETTINGS = {
  // Total number of quick_log episodes to generate
  totalQuickLogs: 80,
  // Date range
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-03-10"),
  // Possible contexts for episodes
  contexts: ["home", "school", "play", "sleep", "meal", "stress"] as const,
};

// Medication log settings
export const MEDICATION_LOG_SETTINGS = {
  // Start date for medication logs (same as first medication start date)
  startDate: new Date("2026-01-20"),
  endDate: new Date("2026-03-10"),
  // Adherence rate (90% = 0.9)
  adherenceRate: 0.9,
};
