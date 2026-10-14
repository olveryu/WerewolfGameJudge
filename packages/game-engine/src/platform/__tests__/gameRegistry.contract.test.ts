/** Game registry contract: the registration metadata must stay welded to the
 * artifacts it describes (canonical game types, engine catalog, package
 * exports, and the completion-reward parameter table), so deleting any
 * game's wiring fails here naming the game instead of shipping silently.
 */

import fs from 'node:fs';
import path from 'node:path';

import { GAME_ENGINE_CATALOG } from '../../games/catalog';
import { GAME_REGISTRY, type GameWorkerWorkflowRegistration } from '../../games/registry';
import { GAME_COMPLETION_REWARDS } from '../../product/rewards/earnings';
import { GAME_TYPES } from '../protocol/gameTypes';

const packageDirectory = path.resolve(__dirname, '..', '..', '..');

interface FlatRewardAmounts {
  readonly xpEarned: number;
  readonly normalDrawsEarned: number;
  readonly dailyCompletionTarget: number;
}

const COMPLETION_REWARD_TABLE: Readonly<Record<string, FlatRewardAmounts>> =
  GAME_COMPLETION_REWARDS;

function readPackageExportPaths(): readonly string[] {
  const packageJson: unknown = JSON.parse(
    fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'),
  );
  if (typeof packageJson !== 'object' || packageJson === null || Array.isArray(packageJson)) {
    throw new Error('game-engine package.json must contain an object');
  }
  const packageExports: unknown = Reflect.get(packageJson, 'exports');
  if (
    typeof packageExports !== 'object' ||
    packageExports === null ||
    Array.isArray(packageExports)
  ) {
    throw new Error('game-engine package.json exports must contain an object');
  }
  return Object.keys(packageExports);
}

describe('game registry completeness', () => {
  it('registers exactly one metadata entry per canonical game type, in canonical order', () => {
    expect(Object.keys(GAME_REGISTRY)).toEqual([...GAME_TYPES]);

    for (const gameType of GAME_TYPES) {
      expect(GAME_REGISTRY[gameType].gameType).toBe(gameType);
    }
  });

  it('covers exactly the games composed in the engine catalog', () => {
    expect(Object.keys(GAME_ENGINE_CATALOG)).toEqual(Object.keys(GAME_REGISTRY));
  });

  it('declares the production dimension for every registered game', () => {
    for (const gameType of GAME_TYPES) {
      expect(typeof GAME_REGISTRY[gameType].isProduction).toBe('boolean');
    }
  });

  it('keeps workflow export names and HTTP route paths unique across games', () => {
    const workflowExportNames = GAME_TYPES.flatMap(
      (gameType): readonly GameWorkerWorkflowRegistration[] =>
        GAME_REGISTRY[gameType].workerWorkflows,
    ).map((workflow) => workflow.exportName);
    const httpRoutePaths = GAME_TYPES.flatMap(
      (gameType): readonly string[] => GAME_REGISTRY[gameType].httpRoutes,
    );

    expect(new Set(workflowExportNames).size).toBe(workflowExportNames.length);
    expect(new Set(httpRoutePaths).size).toBe(httpRoutePaths.length);
  });
});

describe('game registry package exports', () => {
  it('welds every declared public export to the package export map, both ways', () => {
    const exportPaths = readPackageExportPaths();
    const declaredPublicExports = GAME_TYPES.map(
      (gameType) => GAME_REGISTRY[gameType].enginePublicExport,
    );
    const packagedPublicExports = exportPaths.filter((exportPath) =>
      /^\.\/games\/[^/]+\/public$/.test(exportPath),
    );

    expect([...packagedPublicExports].sort()).toEqual([...declaredPublicExports].sort());
  });
});

describe('game registry rewards policy', () => {
  it('welds flat policies to the completion-reward parameter table, both ways', () => {
    const flatGameTypes = GAME_TYPES.filter(
      (gameType) => GAME_REGISTRY[gameType].rewards.policy === 'flat',
    );

    expect([...flatGameTypes].sort()).toEqual(Object.keys(COMPLETION_REWARD_TABLE).sort());

    for (const gameType of flatGameTypes) {
      const registration = GAME_REGISTRY[gameType].rewards;
      if (registration.policy !== 'flat') {
        throw new Error(`game registry rewards for ${gameType} must stay flat in this loop`);
      }
      expect(COMPLETION_REWARD_TABLE[gameType]).toEqual({
        xpEarned: registration.xpEarned,
        normalDrawsEarned: registration.normalDrawsEarned,
        dailyCompletionTarget: registration.dailyCompletionTarget,
      });
    }
  });

  it('keeps levelRoll games out of the flat table and registers their settlement entry point', () => {
    for (const gameType of GAME_TYPES) {
      const registration = GAME_REGISTRY[gameType].rewards;
      if (registration.policy !== 'levelRoll') continue;

      expect(COMPLETION_REWARD_TABLE[gameType]).toBeUndefined();
      expect(registration.settlementModulePath.startsWith(`games/${gameType}/settlement/`)).toBe(
        true,
      );
      expect(registration.settlementExportName.length).toBeGreaterThan(0);
    }
  });
});
