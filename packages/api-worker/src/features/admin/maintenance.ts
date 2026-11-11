/** D1-independent site maintenance configuration, persisted in the existing R2 media bucket. */
import { z } from 'zod';

import type { Env } from '../../env';

const MAINTENANCE_KEY = 'system/maintenance.json';

const maintenanceSchema = z
  .strictObject({
    enabled: z.boolean(),
    message: z.string().trim().min(1).max(500),
    endsAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine((value) => !value.enabled || value.endsAt !== null, {
    message: 'Maintenance requires an end time',
    path: ['endsAt'],
  });

export const maintenanceUpdateSchema = maintenanceSchema.refine(
  (value) => !value.enabled || (value.endsAt !== null && Date.parse(value.endsAt) > Date.now()),
  { message: 'Maintenance end time must be in the future', path: ['endsAt'] },
);

export type MaintenanceConfig = z.infer<typeof maintenanceSchema>;

const DEFAULT_MAINTENANCE: MaintenanceConfig = {
  enabled: false,
  message: '我们正在进行系统维护，暂时无法开始游戏。感谢你的耐心等待。',
  endsAt: null,
};

/** Resolve expiry on the server without a cron job or a read-time write racing newer settings. */
export async function readMaintenance(env: Env): Promise<MaintenanceConfig> {
  const object = await env.GAME_MEDIA.get(MAINTENANCE_KEY);
  if (object === null) return { ...DEFAULT_MAINTENANCE };
  const configuration = maintenanceSchema.parse(await object.json());
  return {
    ...configuration,
    enabled:
      configuration.enabled &&
      configuration.endsAt !== null &&
      Date.parse(configuration.endsAt) > Date.now(),
  };
}

/** Persist a validated configuration without accessing the player database. */
export async function writeMaintenance(env: Env, configuration: MaintenanceConfig): Promise<void> {
  await env.GAME_MEDIA.put(MAINTENANCE_KEY, JSON.stringify(configuration), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
  });
}
