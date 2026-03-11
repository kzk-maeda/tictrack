/**
 * Aggregation utilities for dashboard and reports
 *
 * This module provides the same aggregation logic as report-aggregator Lambda,
 * but implemented in TypeScript for use in the REST API.
 */

interface Episode {
  episodeId: string;
  childId: string;
  occurredAt: string;
  type?: "motor" | "vocal" | "both";
  severity?: number;
  ticCardId?: string;
}

interface TicCard {
  cardId: string;
  label: string;
  symptomId?: string;
}

interface BasicStats {
  totalEpisodes: number;
  recordedDays: number;
  missingDays: number;
  avgPerRecordedDay: number;
  dataCompleteness: string;
}

interface TypeDistribution {
  motor: number;
  vocal: number;
  both: number;
}

interface SeverityDistribution {
  "1": number;
  "2": number;
  "3": number;
  average: number;
}

interface TimePattern {
  "06-12": number;
  "12-18": number;
  "18-22": number;
  "22-06": number;
  peakTime?: string;
}

interface FrequentTic {
  symptom: string;
  count: number;
}

export interface AggregationResult {
  basicStats: BasicStats;
  typeDistribution: TypeDistribution;
  severityDistribution: SeverityDistribution;
  timePattern: TimePattern;
  mostFrequentTics: FrequentTic[];
}

/**
 * Calculate basic statistics with missing-data tolerance
 */
export function calculateBasicStats(
  episodes: Episode[],
  startDate: Date,
  endDate: Date
): BasicStats {
  const totalEpisodes = episodes.length;

  // Calculate recorded days
  let recordedDays = 0;
  if (totalEpisodes > 0) {
    const uniqueDates = new Set(
      episodes.map((ep) => new Date(ep.occurredAt).toISOString().split("T")[0])
    );
    recordedDays = uniqueDates.size;
  }

  // Calculate total days in period
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  const missingDays = totalDays - recordedDays;

  // Calculate average per recorded day
  const avgPerRecordedDay = recordedDays > 0 ? totalEpisodes / recordedDays : 0;

  // Calculate data completeness percentage
  const dataCompleteness = `${((recordedDays / totalDays) * 100).toFixed(1)}%`;

  return {
    totalEpisodes,
    recordedDays,
    missingDays,
    avgPerRecordedDay: Math.round(avgPerRecordedDay * 100) / 100,
    dataCompleteness,
  };
}

/**
 * Calculate type distribution (motor/vocal/both)
 */
export function calculateTypeDistribution(episodes: Episode[]): TypeDistribution {
  const distribution: TypeDistribution = { motor: 0, vocal: 0, both: 0 };

  for (const episode of episodes) {
    const type = episode.type || "motor";
    if (type in distribution) {
      distribution[type]++;
    }
  }

  return distribution;
}

/**
 * Calculate severity distribution (1-3 scale) with average
 */
export function calculateSeverityDistribution(
  episodes: Episode[]
): SeverityDistribution {
  const distribution: SeverityDistribution = { "1": 0, "2": 0, "3": 0, average: 0 };
  let totalSeverity = 0;

  for (const episode of episodes) {
    const severity = episode.severity || 1;
    const severityStr = String(severity) as "1" | "2" | "3";
    if (severityStr in distribution) {
      distribution[severityStr]++;
    }
    totalSeverity += severity;
  }

  const averageSeverity = episodes.length > 0 ? totalSeverity / episodes.length : 0;
  distribution.average = Math.round(averageSeverity * 100) / 100;

  return distribution;
}

/**
 * Calculate time pattern for 6-hour slots (06-12, 12-18, 18-22, 22-06)
 */
export function calculateTimePattern(episodes: Episode[]): TimePattern {
  const pattern: TimePattern = {
    "06-12": 0,
    "12-18": 0,
    "18-22": 0,
    "22-06": 0,
  };

  for (const episode of episodes) {
    const date = new Date(episode.occurredAt);
    const hour = date.getUTCHours();

    if (hour >= 6 && hour < 12) {
      pattern["06-12"]++;
    } else if (hour >= 12 && hour < 18) {
      pattern["12-18"]++;
    } else if (hour >= 18 && hour < 22) {
      pattern["18-22"]++;
    } else {
      pattern["22-06"]++;
    }
  }

  // Find peak time slot (prefer later slots when counts are equal)
  const peakTimeMap = {
    "06-12": "06:00-12:00",
    "12-18": "12:00-18:00",
    "18-22": "18:00-22:00",
    "22-06": "22:00-06:00",
  };

  const slots = ["06-12", "12-18", "18-22", "22-06"] as const;
  const maxCount = Math.max(...Object.values(pattern));

  if (maxCount > 0) {
    // Find the last slot with max count (prefer later time slots)
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i];
      if (pattern[slot] === maxCount) {
        pattern.peakTime = peakTimeMap[slot];
        break;
      }
    }
  }

  return pattern;
}

/**
 * Extract most frequent tics (top 5) with symptom name mapping
 */
export function extractMostFrequentTics(
  episodes: Episode[],
  ticCards: Map<string, TicCard>
): FrequentTic[] {
  // Count tic card frequency
  const ticCardCounts = new Map<string, number>();

  for (const episode of episodes) {
    if (episode.ticCardId) {
      const count = ticCardCounts.get(episode.ticCardId) || 0;
      ticCardCounts.set(episode.ticCardId, count + 1);
    }
  }

  // Sort by frequency and map to symptom names
  const frequentTics: FrequentTic[] = Array.from(ticCardCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cardId, count]) => {
      const card = ticCards.get(cardId);
      return {
        symptom: card?.label || "Unknown tic",
        count,
      };
    });

  return frequentTics;
}

/**
 * Aggregate all statistics for a given period
 */
export function aggregateData(
  episodes: Episode[],
  ticCards: Map<string, TicCard>,
  startDate: Date,
  endDate: Date
): AggregationResult {
  return {
    basicStats: calculateBasicStats(episodes, startDate, endDate),
    typeDistribution: calculateTypeDistribution(episodes),
    severityDistribution: calculateSeverityDistribution(episodes),
    timePattern: calculateTimePattern(episodes),
    mostFrequentTics: extractMostFrequentTics(episodes, ticCards),
  };
}
