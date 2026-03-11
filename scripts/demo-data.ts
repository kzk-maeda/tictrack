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
    symptomId: "motor_simple_eye_blinking",
    label: "Eye blinking",
    severity: 2,
  },
  {
    type: "motor" as const,
    complexity: "simple" as const,
    symptomId: "motor_simple_head_jerking",
    label: "Head jerking",
    severity: 3,
  },
  {
    type: "motor" as const,
    complexity: "simple" as const,
    symptomId: "motor_simple_shoulder_shrugging",
    label: "Shoulder shrugging",
    severity: 2,
  },
  {
    type: "motor" as const,
    complexity: "simple" as const,
    symptomId: "motor_simple_mouth_grimacing",
    label: "Facial grimacing",
    severity: 3,
  },
  {
    type: "motor" as const,
    complexity: "complex" as const,
    symptomId: "motor_complex_touching_objects",
    label: "Touching objects",
    severity: 2,
  },
  {
    type: "vocal" as const,
    complexity: "simple" as const,
    symptomId: "vocal_simple_throat_clearing",
    label: "Throat clearing",
    severity: 3,
  },
  {
    type: "vocal" as const,
    complexity: "simple" as const,
    symptomId: "vocal_simple_sniffing",
    label: "Sniffing",
    severity: 2,
  },
  {
    type: "vocal" as const,
    complexity: "simple" as const,
    symptomId: "vocal_simple_grunting",
    label: "Grunting",
    severity: 2,
  },
  {
    type: "vocal" as const,
    complexity: "complex" as const,
    symptomId: "vocal_complex_word_repetition",
    label: "Word repetition",
    severity: 1,
  },
  {
    type: "motor" as const,
    complexity: "complex" as const,
    customSymptom: "Repeated neck rolling",
    label: "Repeated neck rolling",
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
    name: "Risperidone (Risperdal)",
    type: "antipsychotic" as const,
    dosageMg: 0.5,
    frequency: "Twice daily (morning & evening, after meals)",
    startDate: "2026-01-20",
  },
  {
    name: "Guanfacine (Intuniv)",
    type: "alpha2_agonist" as const,
    dosageMg: 1.0,
    frequency: "Once daily (before bedtime)",
    startDate: "2026-01-25",
  },
];

// Life event definitions
export const LIFE_EVENTS = [
  {
    type: "graduation" as const,
    title: "Preschool graduation",
    occurredAt: "2026-03-15",
    stressLevel: 4,
    notes: "Showing signs of nervousness about starting elementary school",
  },
  {
    type: "medical" as const,
    title: "First visit to pediatric neurologist",
    occurredAt: "2026-01-15",
    stressLevel: 3,
    notes: "Consultation with specialist about tic symptoms",
  },
  {
    type: "social" as const,
    title: "School recital",
    occurredAt: "2026-02-10",
    stressLevel: 4,
    notes: "Nervous about performing in front of large audience",
  },
  {
    type: "family_change" as const,
    title: "Baby sister born",
    occurredAt: "2026-01-30",
    stressLevel: 2,
    notes: "Change in family structure",
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
