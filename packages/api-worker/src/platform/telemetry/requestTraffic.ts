/** HTTP request traffic metric encoding for the request_traffic Analytics Engine dataset. */

export const LEGACY_ROOM_STATE_ROUTE = '/room/state';
export const PREFLIGHT_REQUEST_ROUTE = '__preflight__';
export const UNMATCHED_REQUEST_ROUTE = '__unmatched__';
export const UNKNOWN_TRAFFIC_DIMENSION = 'unknown';
export const HTTP_REQUEST_EVENT_KIND = 'HTTP_REQUEST';

export interface HttpRequestTrafficEvent {
  readonly method: string;
  readonly route: string;
  readonly status: number;
  readonly durationMs: number;
  readonly country: string;
  readonly colo: string;
  readonly deploymentId: string;
}

interface ResolveHttpRequestRouteInput {
  readonly method: string;
  readonly requestPath: string;
  readonly registeredRoutePath: string;
}

/** Resolve a bounded route label without recording dynamic request path values. */
export function resolveHttpRequestRoute(input: ResolveHttpRequestRouteInput): string {
  if (input.method === 'OPTIONS') return PREFLIGHT_REQUEST_ROUTE;
  if (input.requestPath === LEGACY_ROOM_STATE_ROUTE) return LEGACY_ROOM_STATE_ROUTE;
  if (input.registeredRoutePath.length === 0 || input.registeredRoutePath === '*') {
    return UNMATCHED_REQUEST_ROUTE;
  }
  return input.registeredRoutePath;
}

/** Record one completed HTTP request without creating an HTTP subrequest. */
export function recordHttpRequestTraffic(
  dataset: AnalyticsEngineDataset,
  event: HttpRequestTrafficEvent,
): void {
  dataset.writeDataPoint({
    indexes: [`http:${event.route}`],
    blobs: [
      HTTP_REQUEST_EVENT_KIND,
      event.method,
      event.route,
      String(event.status),
      `${Math.floor(event.status / 100)}xx`,
      event.country,
      event.colo,
      event.deploymentId,
    ],
    doubles: [event.durationMs],
  });
}
