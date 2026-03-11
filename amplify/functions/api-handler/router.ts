import type { APIGatewayProxyEvent } from "aws-lambda";
import type { RouteDefinition, RouteResult } from "./types.js";
import { listChildren, createChild, updateChild, deleteChild, setDefaultChild } from "./routes/children.js";
import { getMe, updateMe } from "./routes/users.js";
import { listTicCards, createTicCard, updateTicCard, deleteTicCard } from "./routes/tic-cards.js";
import { listMedicationCards, createMedicationCard, updateMedicationCard, deleteMedicationCard, listMedicationLogs, createMedicationLog, deleteMedicationLog } from "./routes/medications.js";
import { listLifeEvents, createLifeEvent, updateLifeEvent, deleteLifeEvent } from "./routes/life-events.js";
import { listEpisodes, createEpisode, deleteEpisode, submitEpisodeFeedback, getEpisodeAILabel, getAnalysisStatus } from "./routes/episodes.js";
import { handleVideoUploadUrl, handleVideoUploadComplete, handleVideoPlaybackUrl } from "./routes/videos.js";
import { getDashboard } from "./routes/dashboard.js";
import { NotFoundError } from "./lib/errors.js";

const routes: RouteDefinition[] = [
  { method: "GET", pattern: /^\/children$/, handler: (e) => listChildren(e) },
  { method: "POST", pattern: /^\/children$/, handler: (e) => createChild(e) },
  {
    method: "PUT",
    pattern: /^\/children\/([^/]+)$/,
    handler: (e, p) => updateChild(e, p),
  },
  {
    method: "DELETE",
    pattern: /^\/children\/([^/]+)$/,
    handler: (e, p) => deleteChild(e, p),
  },
  {
    method: "POST",
    pattern: /^\/children\/([^/]+)\/set-default$/,
    handler: (e, p) => setDefaultChild(e, p),
  },
  { method: "GET", pattern: /^\/users\/me$/, handler: (e) => getMe(e) },
  { method: "PUT", pattern: /^\/users\/me$/, handler: (e) => updateMe(e) },

  // TicCards
  { method: "GET", pattern: /^\/children\/([^/]+)\/tic-cards$/, handler: (e, p) => listTicCards(e, p) },
  { method: "POST", pattern: /^\/children\/([^/]+)\/tic-cards$/, handler: (e, p) => createTicCard(e, p) },
  {
    method: "PUT",
    pattern: /^\/children\/([^/]+)\/tic-cards\/([^/]+)$/,
    handler: (e, p) => updateTicCard(e, p),
  },
  {
    method: "DELETE",
    pattern: /^\/children\/([^/]+)\/tic-cards\/([^/]+)$/,
    handler: (e, p) => deleteTicCard(e, p),
  },

  // Medications
  { method: "GET", pattern: /^\/children\/([^/]+)\/medications$/, handler: (e, p) => listMedicationCards(e, p) },
  { method: "POST", pattern: /^\/children\/([^/]+)\/medications$/, handler: (e, p) => createMedicationCard(e, p) },
  {
    method: "PUT",
    pattern: /^\/children\/([^/]+)\/medications\/([^/]+)$/,
    handler: (e, p) => updateMedicationCard(e, p),
  },
  {
    method: "DELETE",
    pattern: /^\/children\/([^/]+)\/medications\/([^/]+)$/,
    handler: (e, p) => deleteMedicationCard(e, p),
  },
  { method: "GET", pattern: /^\/children\/([^/]+)\/medication-logs$/, handler: (e, p) => listMedicationLogs(e, p) },
  {
    method: "POST",
    pattern: /^\/children\/([^/]+)\/medications\/([^/]+)\/logs$/,
    handler: (e, p) => createMedicationLog(e, p),
  },
  {
    method: "DELETE",
    pattern: /^\/children\/([^/]+)\/medication-logs\/([^/]+)$/,
    handler: (e, p) => deleteMedicationLog(e, p),
  },

  // Life Events
  { method: "GET", pattern: /^\/children\/([^/]+)\/life-events$/, handler: (e, p) => listLifeEvents(e, p) },
  { method: "POST", pattern: /^\/children\/([^/]+)\/life-events$/, handler: (e, p) => createLifeEvent(e, p) },
  {
    method: "PUT",
    pattern: /^\/life-events\/([^/]+)$/,
    handler: (e, p) => updateLifeEvent(e, p),
  },
  {
    method: "DELETE",
    pattern: /^\/life-events\/([^/]+)$/,
    handler: (e, p) => deleteLifeEvent(e, p),
  },

  // Episodes
  { method: "GET", pattern: /^\/children\/([^/]+)\/episodes$/, handler: (e, p) => listEpisodes(e, p) },
  { method: "POST", pattern: /^\/children\/([^/]+)\/episodes$/, handler: (e, p) => createEpisode(e, p) },
  {
    method: "DELETE",
    pattern: /^\/children\/([^/]+)\/episodes\/([^/]+)$/,
    handler: (e, p) => deleteEpisode(e, p),
  },
  {
    method: "PUT",
    pattern: /^\/children\/([^/]+)\/episodes\/([^/]+)\/feedback$/,
    handler: (e, p) => submitEpisodeFeedback(e, p),
  },
  {
    method: "GET",
    pattern: /^\/children\/([^/]+)\/episodes\/([^/]+)\/ai-label$/,
    handler: (e, p) => getEpisodeAILabel(e, p),
  },
  {
    method: "GET",
    pattern: /^\/children\/([^/]+)\/episodes\/([^/]+)\/analysis-status$/,
    handler: (e, p) => getAnalysisStatus(e, p),
  },

  // Video Upload
  {
    method: "POST",
    pattern: /^\/children\/([^/]+)\/episodes\/([^/]+)\/upload-url$/,
    handler: (e) => handleVideoUploadUrl(e),
  },
  {
    method: "POST",
    pattern: /^\/children\/([^/]+)\/episodes\/([^/]+)\/upload-complete$/,
    handler: (e) => handleVideoUploadComplete(e),
  },
  {
    method: "GET",
    pattern: /^\/children\/([^/]+)\/episodes\/([^/]+)\/video-url$/,
    handler: (e) => handleVideoPlaybackUrl(e),
  },

  // Dashboard
  {
    method: "GET",
    pattern: /^\/children\/([^/]+)\/dashboard$/,
    handler: (e, p) => getDashboard(e, p),
  },
];

export async function route(
  event: APIGatewayProxyEvent,
): Promise<RouteResult> {
  // Strip stage prefix if present (e.g., /dev/children -> /children)
  const rawPath = event.path || "/";
  // Only remove known stage names, not all first segments
  const path = rawPath.replace(/^\/(dev|prod|staging)(?=\/)/, "") || "/";

  console.log(`[Router] Raw path: ${rawPath}, Normalized path: ${path}, Method: ${event.httpMethod}`);

  for (const def of routes) {
    if (event.httpMethod !== def.method) continue;
    const match = path.match(def.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    if (match[1]) params.childId = match[1];
    if (match[2]) params.cardId = match[2];
    if (match[2]) params.episodeId = match[2];
    if (match[2]) params.medicationId = match[2];
    if (match[2]) params.logId = match[2];

    // Set pathParameters on event so handlers can access them
    event.pathParameters = params;

    console.log(`[Router] Matched route: ${def.method} ${def.pattern}, params:`, params);
    return def.handler(event, params);
  }

  console.error(`[Router] No route found. Available routes:`, routes.map(r => `${r.method} ${r.pattern}`));
  throw new NotFoundError(`No route found for ${event.httpMethod} ${path}`);
}
