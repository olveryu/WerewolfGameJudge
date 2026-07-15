/** Typed Durable Object stub lookup from an immutable directory instance ID. */

import type { Env } from '../../env';
import type { GameRoomRuntime } from './GameRoomRuntime';

type StripDisposable<T> = T extends Disposable ? Omit<T, keyof Disposable> : T;

type CleanRpcMethods<DO> = {
  [K in keyof DO]: DO[K] extends (...args: infer TArgs) => Promise<infer TResult>
    ? (...args: TArgs) => Promise<StripDisposable<TResult>>
    : DO[K];
};

export type GameRoomStub = CleanRpcMethods<DurableObjectStub<GameRoomRuntime>>;

const CONTINENT_TO_HINT: Partial<Record<string, DurableObjectLocationHint>> = {
  AS: 'apac',
  OC: 'oc',
  EU: 'weur',
  NA: 'enam',
  SA: 'enam',
  AF: 'afr',
};

type CfRequest = Request & { cf?: IncomingRequestCfProperties };

export function getGameRoomStub(env: Env, roomId: string, request?: Request): GameRoomStub {
  const id = env.GAME_ROOM.idFromString(roomId);
  const continent = (request as CfRequest | undefined)?.cf?.continent;
  const locationHint = continent === undefined ? undefined : CONTINENT_TO_HINT[continent];
  return env.GAME_ROOM.get(id, locationHint === undefined ? undefined : { locationHint });
}
