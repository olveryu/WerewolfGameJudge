/** Standard root-route parsers shared by every game's navigation contribution. */

import { type GameType, parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import { assertExactRouteParamKeys, parseRouteParams } from './routeParams';

export type StandardConfigRouteParams<
  TGameType extends GameType,
  TExtraMode extends string = never,
> =
  | { readonly gameType: TGameType; readonly mode: 'create' }
  | { readonly gameType: TGameType; readonly mode: 'edit'; readonly roomCode: string }
  | { readonly gameType: TGameType; readonly mode: TExtraMode; readonly roomCode: string };

/**
 * Builds the standard config route parser for one game: create without a room
 * code, edit (plus any game-specific room-code modes) with a valid room code.
 */
export function createStandardConfigRouteParser<
  TGameType extends GameType,
  TExtraMode extends string = never,
>(options: {
  readonly gameType: TGameType;
  readonly displayName: string;
  readonly extraRoomCodeModes?: readonly TExtraMode[];
}): (value: unknown) => StandardConfigRouteParams<TGameType, TExtraMode> {
  const routeLabel = `${options.displayName} config`;
  const extraRoomCodeModes: readonly TExtraMode[] = options.extraRoomCodeModes ?? [];
  return (value: unknown): StandardConfigRouteParams<TGameType, TExtraMode> => {
    const params = parseRouteParams(value, routeLabel);
    const gameType = parseGameType(params.gameType);
    if (gameType !== options.gameType) {
      throw new Error(`[FAIL-FAST] ${routeLabel} received game type ${gameType}`);
    }
    const mode = params.mode;
    if (typeof mode !== 'string') {
      throw new Error(`[FAIL-FAST] ${routeLabel} mode must be a string`);
    }
    assertExactRouteParamKeys(params, ['gameType', 'mode', 'roomCode'], routeLabel);
    if (mode === 'create') {
      if (params.roomCode !== undefined) {
        throw new Error(
          `[FAIL-FAST] ${options.displayName} create config must not include a room code`,
        );
      }
      return { gameType: options.gameType, mode };
    }
    if (mode === 'edit') {
      return { gameType: options.gameType, mode, roomCode: parseRoomCode(params.roomCode) };
    }
    for (const extraMode of extraRoomCodeModes) {
      if (mode === extraMode) {
        return {
          gameType: options.gameType,
          mode: extraMode,
          roomCode: parseRoomCode(params.roomCode),
        };
      }
    }
    throw new Error(`[FAIL-FAST] Unknown ${routeLabel} mode: ${mode}`);
  };
}

export interface StandardGuideRouteParams<TGameType extends GameType> {
  readonly gameType: TGameType;
  readonly roomCode?: string;
}

/**
 * Builds the standard guide route parser for one game: an optional room code
 * plus game-specific extra fields validated by the injected parser.
 */
export function createStandardGuideRouteParser<
  TGameType extends GameType,
  TExtra extends object = Record<never, never>,
>(options: {
  readonly gameType: TGameType;
  readonly displayName: string;
  readonly extraFields?: {
    readonly keys: readonly string[];
    readonly parse: (params: Readonly<Record<string, unknown>>) => TExtra;
  };
}): (value: unknown) => StandardGuideRouteParams<TGameType> & TExtra {
  const routeLabel = `${options.displayName} guide`;
  const extraKeys = options.extraFields?.keys ?? [];
  return (value: unknown): StandardGuideRouteParams<TGameType> & TExtra => {
    const params = parseRouteParams(value, routeLabel);
    const gameType = parseGameType(params.gameType);
    if (gameType !== options.gameType) {
      throw new Error(`[FAIL-FAST] ${routeLabel} received game type ${gameType}`);
    }
    assertExactRouteParamKeys(params, ['gameType', 'roomCode', ...extraKeys], routeLabel);
    const roomCode = params.roomCode === undefined ? undefined : parseRoomCode(params.roomCode);
    const extra: TExtra | Record<never, never> = options.extraFields
      ? options.extraFields.parse(params)
      : {};
    return { gameType: options.gameType, roomCode, ...extra };
  };
}
