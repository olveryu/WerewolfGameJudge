/** Registration metadata for every registered game type.
 *
 * The exhaustive engine, Worker, and client catalogs remain the runtime
 * composition points; this registry only records the registration facts they
 * cannot carry: the public export path, the client entry module, whether the
 * game is in production, its reward policy, its Worker workflow exports, and
 * its game-owned HTTP route paths. Contract tests weld every fact here to
 * the artifact it describes, so a missing wiring fails CI naming the game
 * instead of silently shipping without it.
 */

import type { GameType } from '../platform/protocol/gameTypes';
import { GAME_COMPLETION_REWARDS } from '../product/rewards/earnings';

/** Completion reward policy declared by a registered game.
 *
 * `flat` games settle through the shared completion pipeline and must carry
 * the three flat amounts from the product-owned `GAME_COMPLETION_REWARDS`.
 * `levelRoll` games settle through
 * their own pipeline (XP rolled from the player's level), so the flat
 * amounts do not apply and the pipeline entry point is registered instead.
 */
export type GameRegistrationRewards<TGameType extends GameType = GameType> =
  | {
      readonly policy: 'flat';
      readonly xpEarned: number;
      readonly normalDrawsEarned: number;
      readonly dailyCompletionTarget: number;
    }
  | {
      readonly policy: 'levelRoll';
      /** Worker module (relative to `packages/api-worker/src`, no extension) exporting the settlement entry point. */
      readonly settlementModulePath: `games/${TGameType}/settlement/${string}`;
      readonly settlementExportName: string;
    };

/** A Cloudflare Workflow class the Worker entrypoint must re-export for a game. */
export interface GameWorkerWorkflowRegistration<TGameType extends GameType = GameType> {
  readonly exportName: string;
  /** Module specifier re-exported from `packages/api-worker/src/index.ts`. */
  readonly modulePath: `./games/${TGameType}/${string}`;
}

/** Registration facts for one game type. */
export interface GameRegistration<TGameType extends GameType = GameType> {
  readonly gameType: TGameType;
  /** Package subpath of the game's public engine entrypoint. */
  readonly enginePublicExport: `./games/${TGameType}/public`;
  /** Client module composing the game's plugin (repo-relative source path). */
  readonly clientModulePath: `src/games/${TGameType}/module.ts`;
  /**
   * Whether the game is in production （是否投产）. Production registrations
   * may appear on player-facing surfaces (lobby, room creation); a game that
   * is registered but not yet in production must be filtered out there.
   */
  readonly isProduction: boolean;
  readonly rewards: GameRegistrationRewards<TGameType>;
  readonly workerWorkflows: readonly GameWorkerWorkflowRegistration<TGameType>[];
  /** Game-owned HTTP route paths the Worker module must register. */
  readonly httpRoutes: readonly `/api/games/${TGameType}/${string}`[];
}

/** The single registration-metadata source, exhaustive over `GameType`. */
export const GAME_REGISTRY = {
  werewolf: {
    gameType: 'werewolf',
    enginePublicExport: './games/werewolf/public',
    clientModulePath: 'src/games/werewolf/module.ts',
    isProduction: true,
    rewards: {
      policy: 'levelRoll',
      settlementModulePath: 'games/werewolf/settlement/settleGameResults',
      settlementExportName: 'settleGameResults',
    },
    workerWorkflows: [],
    httpRoutes: ['/api/games/werewolf/ai-chat'],
  },
  fibking: {
    gameType: 'fibking',
    enginePublicExport: './games/fibking/public',
    clientModulePath: 'src/games/fibking/module.ts',
    isProduction: true,
    rewards: { policy: 'flat', ...GAME_COMPLETION_REWARDS.fibking },
    workerWorkflows: [
      { exportName: 'FibWordSupplyWorkflow', modulePath: './games/fibking/wordSupplyWorkflow' },
    ],
    httpRoutes: [],
  },
  pictionary: {
    gameType: 'pictionary',
    enginePublicExport: './games/pictionary/public',
    clientModulePath: 'src/games/pictionary/module.ts',
    isProduction: true,
    rewards: { policy: 'flat', ...GAME_COMPLETION_REWARDS.pictionary },
    workerWorkflows: [],
    httpRoutes: ['/api/games/pictionary/rooms'],
  },
  undercover: {
    gameType: 'undercover',
    enginePublicExport: './games/undercover/public',
    clientModulePath: 'src/games/undercover/module.ts',
    isProduction: true,
    rewards: { policy: 'flat', ...GAME_COMPLETION_REWARDS.undercover },
    workerWorkflows: [
      {
        exportName: 'UndercoverWordSupplyWorkflow',
        modulePath: './games/undercover/wordSupplyWorkflow',
      },
    ],
    httpRoutes: ['/api/games/undercover/inventory'],
  },
  storyrelay: {
    gameType: 'storyrelay',
    enginePublicExport: './games/storyrelay/public',
    clientModulePath: 'src/games/storyrelay/module.ts',
    isProduction: true,
    rewards: { policy: 'flat', ...GAME_COMPLETION_REWARDS.storyrelay },
    workerWorkflows: [],
    httpRoutes: [],
  },
  drawguess: {
    gameType: 'drawguess',
    enginePublicExport: './games/drawguess/public',
    clientModulePath: 'src/games/drawguess/module.ts',
    isProduction: true,
    rewards: { policy: 'flat', ...GAME_COMPLETION_REWARDS.drawguess },
    workerWorkflows: [
      {
        exportName: 'DrawGuessWordSupplyWorkflow',
        modulePath: './games/drawguess/wordSupplyWorkflow',
      },
    ],
    httpRoutes: ['/api/games/drawguess/rooms'],
  },
  avalon: {
    gameType: 'avalon',
    enginePublicExport: './games/avalon/public',
    clientModulePath: 'src/games/avalon/module.ts',
    isProduction: true,
    rewards: { policy: 'flat', ...GAME_COMPLETION_REWARDS.avalon },
    workerWorkflows: [],
    httpRoutes: [],
  },
  demo: {
    gameType: 'demo',
    enginePublicExport: './games/demo/public',
    clientModulePath: 'src/games/demo/module.ts',
    // Reference game for template regression (plan §7.1 / D8): fully
    // registered through the real path, never shipped to players — the
    // client lobby/create surfaces filter on this flag.
    isProduction: false,
    rewards: { policy: 'flat', ...GAME_COMPLETION_REWARDS.demo },
    workerWorkflows: [],
    httpRoutes: [],
  },
} as const satisfies { readonly [TGameType in GameType]: GameRegistration<TGameType> };

export type GameRegistry = typeof GAME_REGISTRY;
