import type { APIGatewayProxyEvent } from "aws-lambda";
import type { RouteDefinition, RouteResult } from "./types.js";
import { listChildren, createChild, updateChild, deleteChild, setDefaultChild } from "./routes/children.js";
import { getMe, updateMe } from "./routes/users.js";
import { listTicCards, createTicCard, updateTicCard, deleteTicCard } from "./routes/tic-cards.js";
import { listEpisodes, createEpisode, deleteEpisode, submitEpisodeFeedback, getEpisodeAILabel, getAnalysisStatus } from "./routes/episodes.js";
import { handleVideoUploadUrl, handleVideoUploadComplete, handleVideoPlaybackUrl } from "./routes/videos.js";
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
];

export async function route(
  event: APIGatewayProxyEvent,
): Promise<RouteResult> {
  // Strip stage prefix if present (e.g., /dev/children -> /children)
  const path = event.path.replace(/^\/dev/, "") || "/";

  for (const def of routes) {
    if (event.httpMethod !== def.method) continue;
    const match = path.match(def.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    if (match[1]) params.childId = match[1];
    if (match[2]) params.cardId = match[2];
    if (match[2]) params.episodeId = match[2];

    // Set pathParameters on event so handlers can access them
    event.pathParameters = params;

    return def.handler(event, params);
  }

  throw new NotFoundError(`No route found for ${event.httpMethod} ${path}`);
}
