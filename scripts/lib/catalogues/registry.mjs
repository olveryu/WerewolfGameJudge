/** Reviewed catalogue locations; generated files remain beside their owning tests. */
export const CATALOGUES = [
  {
    id: 'werewolf-night',
    title: '狼人杀首夜',
    packageName: '@game-judge/game-engine',
    test: 'src/games/werewolf/__tests__/boards/night1.catalogue.integration.test.ts',
    baseline:
      'packages/game-engine/src/games/werewolf/__tests__/boards/__snapshots__/night-steps.catalogue.txt',
  },
  {
    id: 'werewolf-sheriff',
    title: '狼人杀警长竞选',
    packageName: '@game-judge/web',
    test: 'src/games/werewolf/room/day/__tests__/sheriffElection.catalogue.test.tsx',
    baseline:
      'packages/web/src/games/werewolf/room/day/__tests__/__snapshots__/sheriff-election.catalogue.txt',
  },
  {
    id: 'avalon-night',
    title: '阿瓦隆夜晚',
    packageName: '@game-judge/game-engine',
    test: 'src/games/avalon/__tests__/nightCatalogue.integration.test.ts',
    baseline:
      'packages/game-engine/src/games/avalon/__tests__/__snapshots__/night-steps.catalogue.txt',
  },
  {
    id: 'secrethitler-night',
    title: '秘密希特勒首夜',
    packageName: '@game-judge/game-engine',
    test: 'src/games/secrethitler/__tests__/nightCatalogue.integration.test.ts',
    baseline:
      'packages/game-engine/src/games/secrethitler/__tests__/__snapshots__/night-steps.catalogue.txt',
  },
];
