/**
 * Load-timing beacon for the `load_timing` Analytics Engine dataset (operator / CDN-node
 * breakdowns that Sentry does not cover). Payload shape is fixed by the worker's
 * `loadTimingSchema`; `totalMs` spans `boot:start` → `app:registered`.
 */
import { API_BASE_URL } from '@/config/api';
import { createLogger } from '@/utils/logger';

const bootLog = createLogger('Boot');
const MAX_RESOURCES = 50;
const SIGNIFICANT_BYTES = 1024;

function markTime(name: string): number {
  const mark = performance.getEntriesByName(name, 'mark')[0];
  if (mark === undefined) throw new Error(`Missing performance mark "${name}"`);
  return mark.startTime;
}

function isResourceTiming(entry: PerformanceEntry): entry is PerformanceResourceTiming {
  return entry.entryType === 'resource';
}

function isNavigationTiming(entry: PerformanceEntry): entry is PerformanceNavigationTiming {
  return entry.entryType === 'navigation';
}

/** Sends the beacon; call once `app:registered` has been marked. */
export function reportLoadTiming(): void {
  const navigation = performance.getEntriesByType('navigation').find(isNavigationTiming);
  const resources = performance
    .getEntriesByType('resource')
    .filter(isResourceTiming)
    .filter((entry) => entry.transferSize > SIGNIFICANT_BYTES || entry.name.includes('.js'))
    .slice(0, MAX_RESOURCES)
    .map((entry) => ({
      name: entry.name,
      duration: Math.round(entry.duration),
      transferSize: Math.round(entry.transferSize),
      decodedBodySize: Math.round(entry.decodedBodySize),
      dns: Math.round(entry.domainLookupEnd - entry.domainLookupStart),
      tcp: Math.round(entry.connectEnd - entry.connectStart),
      tls:
        entry.secureConnectionStart > 0
          ? Math.round(entry.connectEnd - entry.secureConnectionStart)
          : 0,
      ttfb: Math.round(entry.responseStart - entry.requestStart),
      download: Math.round(entry.responseEnd - entry.responseStart),
    }));
  if (resources.length === 0) return;

  const payload = JSON.stringify({
    totalMs: Math.round(markTime('app:registered') - markTime('boot:start')),
    htmlTtfb: navigation ? Math.round(navigation.responseStart - navigation.startTime) : 0,
    resources,
    ua: navigator.userAgent,
  });
  if (!navigator.sendBeacon(`${API_BASE_URL}/telemetry/load-timing`, payload)) {
    bootLog.warn('Load-timing beacon was not queued');
  }
}
