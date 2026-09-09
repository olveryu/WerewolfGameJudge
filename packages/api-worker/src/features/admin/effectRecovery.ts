/** Admin-only effect recovery and audit routes, mounted behind requireAdmin.
 * @throws 400 Invalid request identity or reason.
 * @throws 503 Room authority unavailable or recovery request rejected.
 */
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../../env';
import { callDurableObject } from '../../platform/http/callDurableObject';
import { jsonBody } from '../../platform/http/jsonBody';
import { getGameRoomStub } from '../../platform/room/roomStub';

const readReplaySchema = z.strictObject({
  roomCode: z.string().regex(/^\d{4}$/),
  roomId: z.string().regex(/^[a-f0-9]{64}$/),
  creationId: z.string().min(1).max(128),
  id: z.uuid(),
});
const replaySchema = readReplaySchema.extend({
  effectId: z.string().min(1).max(512),
  reason: z.string().trim().min(1).max(1000),
});

export const effectRecoveryRoutes = new Hono<AppEnv>();

effectRecoveryRoutes.post('/', jsonBody(replaySchema), async (context) => {
  const command = context.req.valid('json');
  const stub = getGameRoomStub(context.env, command.roomId);
  await callDurableObject(() => stub.replayFailedEffect(command));
  return context.json({ success: true, id: command.id }, 202);
});

effectRecoveryRoutes.post('/read', jsonBody(readReplaySchema), async (context) => {
  const command = context.req.valid('json');
  const stub = getGameRoomStub(context.env, command.roomId);
  const replay = await callDurableObject(() => stub.readEffectReplay(command));
  return context.json({ replay });
});
