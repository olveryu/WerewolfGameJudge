/** Public maintenance status contract and D1-independent status request. */
import { z } from 'zod';

import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/api';
import { composeAbortSignals, createTimeoutSignal } from '@/utils/abortSignal';

export const maintenanceSchema = z
  .strictObject({
    enabled: z.boolean(),
    message: z.string().trim().min(1).max(500),
    endsAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine((value) => !value.enabled || value.endsAt !== null, {
    message: 'Maintenance requires an end time',
    path: ['endsAt'],
  });

export type MaintenanceConfig = z.infer<typeof maintenanceSchema>;

export const MAINTENANCE_QUERY_KEY = ['site-maintenance'] as const;
export const MAINTENANCE_POLL_MS = 60_000;

/** Display the recovery instant with the viewer's local timezone explicitly included. */
export function formatMaintenanceEnd(endsAt: string | null): string {
  if (endsAt === null) return '尚未设置恢复时间';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(endsAt));
}

/** Convert an absolute instant to the local wall-clock value expected by datetime-local. */
export function maintenanceEndInputValue(endsAt: string | null): string {
  if (endsAt === null) return '';
  const date = new Date(endsAt);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Fetch uncached status without player credentials or database-backed services. */
export async function fetchMaintenance(signal?: AbortSignal): Promise<MaintenanceConfig> {
  const timeout = createTimeoutSignal(API_TIMEOUT_MS);
  const composed = composeAbortSignals(signal ? [signal, timeout] : [timeout]);
  try {
    const response = await fetch(`${API_BASE_URL}/maintenance`, {
      cache: 'no-store',
      signal: composed.signal,
    });
    if (!response.ok) throw new Error(`读取维护状态失败 (${response.status})`);
    const body: unknown = await response.json();
    return maintenanceSchema.parse(body);
  } finally {
    composed.dispose();
  }
}
