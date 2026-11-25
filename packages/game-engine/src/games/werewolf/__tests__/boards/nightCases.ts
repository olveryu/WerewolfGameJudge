/**
 * The Night-1 suite: every preset board and every rule scenario, each played
 * from the deal through production commands.
 */

import {
  type GameState,
  PRESET_TEMPLATES,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';

import { getWerewolfRoleDefinition } from '../../roles/nightPlan';
import type { GameContext } from './gameContext';
import { createGame } from './gameFactory';
import { type NightRun, playScenarioNight } from './nightDriver';
import { NIGHT_SCENARIOS } from './nightScenarios';
import type { NightActions } from './nightScript';

const BOTTOM_CARD_SEED = 'bottom-fixture-1';

const TREASURE_MASTER_ROLES: RoleId[] = [
  'psychic',
  'poisoner',
  'hunter',
  'dreamcatcher',
  'crow',
  'darkWolfKing',
  'wolf',
  'wolf',
  'wolf',
  'treasureMaster',
  'villager',
  'villager',
  'villager',
  'villager',
  'villager',
];

const TREASURE_MASTER_WITCHER_ROLES: RoleId[] = TREASURE_MASTER_ROLES.map((roleId) =>
  roleId === 'dreamcatcher' ? 'witcher' : roleId,
);
const BOTTOM_CARD_SEED_SEARCH_LIMIT = 64;

function getPlayers(state: GameState): readonly { readonly seat: number; readonly role: RoleId }[] {
  return Object.entries(state.players).flatMap(([seat, player]) =>
    player?.role == null ? [] : [{ seat: Number(seat), role: player.role }],
  );
}

function hasRole(state: GameState, roleId: RoleId): boolean {
  return getPlayers(state).some((player) => player.role === roleId);
}

function findRoleSeat(state: GameState, roleId: RoleId): number {
  const player = getPlayers(state).find((candidate) => candidate.role === roleId);
  if (player === undefined) throw new Error(`[FAIL-FAST] No seat holds ${roleId}`);
  return player.seat;
}

function requireSeat(seats: readonly number[], index: number): number {
  const seat = seats[index];
  if (seat === undefined) throw new Error(`[FAIL-FAST] Missing seat at index ${index}`);
  return seat;
}

function requireBottomCard(state: GameState, roleId: RoleId): number {
  const index = state.bottomCards?.indexOf(roleId) ?? -1;
  if (index === -1) throw new Error(`[FAIL-FAST] ${roleId} is not a bottom card`);
  return index;
}

function isWolfFaction(roleId: RoleId): boolean {
  return getWerewolfRoleDefinition(roleId).traits.faction === 'wolf';
}

function chooseBottomCard(state: GameState, isThief: boolean): number {
  const cards = state.bottomCards;
  if (cards === undefined) throw new Error('[FAIL-FAST] Missing bottom cards');
  const wolfCard = cards.findIndex(isWolfFaction);
  const chosen = isThief && wolfCard !== -1 ? wolfCard : cards.indexOf('villager');
  if (chosen === -1) throw new Error('[FAIL-FAST] No eligible bottom card');
  return chosen;
}

function findAdjacentConversionTarget(state: GameState): number {
  const players = getPlayers(state);
  const actorSeat = findRoleSeat(state, 'awakenedGargoyle');
  const wolfSeats = players.filter((player) => isWolfFaction(player.role)).map(({ seat }) => seat);
  const target = players.find((player) => {
    if (player.seat === actorSeat || isWolfFaction(player.role)) return false;
    return wolfSeats.some((wolfSeat) => {
      const distance = Math.abs(player.seat - wolfSeat);
      return distance === 1 || distance === players.length - 1;
    });
  });
  if (target === undefined) throw new Error('[FAIL-FAST] No adjacent conversion target');
  return target.seat;
}

/** One ordinary night for any preset: wolves attack a villager, checkers check a wolf. */
function createPresetChoices(state: GameState): NightActions {
  const players = getPlayers(state);
  const villagerSeats = players.filter(({ role }) => role === 'villager').map(({ seat }) => seat);
  const firstOtherSeat = (roleId: RoleId, isWanted: (role: RoleId) => boolean): number => {
    const actorSeat = findRoleSeat(state, roleId);
    const target = players.find((player) => player.seat !== actorSeat && isWanted(player.role));
    if (target === undefined) throw new Error(`[FAIL-FAST] No target for ${roleId}`);
    return target.seat;
  };
  const nonWolfTarget = (roleId: RoleId): number =>
    firstOtherSeat(roleId, (role) => !isWolfFaction(role));
  const wolfTarget = (roleId: RoleId): number => firstOtherSeat(roleId, isWolfFaction);

  const choices: NightActions = {
    wolf: state.templateRoles.includes('poisoner') ? null : requireSeat(villagerSeats, 0),
    witch: null,
    guard: null,
    seedWolf: { confirmed: false },
  };
  for (const roleId of ['slacker', 'wildChild', 'shadow', 'wolfGirl'] as const) {
    if (hasRole(state, roleId)) choices[roleId] = nonWolfTarget(roleId);
  }
  for (const roleId of ['seer', 'mirrorSeer', 'psychic', 'pureWhite'] as const) {
    if (hasRole(state, roleId)) choices[roleId] = wolfTarget(roleId);
  }
  for (const roleId of ['gargoyle', 'wolfWitch'] as const) {
    if (hasRole(state, roleId)) choices[roleId] = nonWolfTarget(roleId);
  }
  if (hasRole(state, 'piper')) choices.piper = { targets: [nonWolfTarget('piper')] };
  if (hasRole(state, 'cupid')) {
    choices.cupid = { targets: [requireSeat(villagerSeats, 1), requireSeat(villagerSeats, 2)] };
  }
  if (hasRole(state, 'awakenedGargoyle')) {
    choices.awakenedGargoyle = findAdjacentConversionTarget(state);
  }
  if (hasRole(state, 'thief')) choices.thief = { cardIndex: chooseBottomCard(state, true) };
  if (hasRole(state, 'treasureMaster')) {
    choices.treasureMaster = { cardIndex: chooseBottomCard(state, false) };
  }
  return choices;
}

/** One night of the suite; `play` replays it from the deal through production commands. */
export interface NightCase {
  readonly name: string;
  readonly play: () => NightRun;
}

function playPresetVariant(
  presetName: string,
  targetRole: RoleId,
  vary: (targetSeat: number) => NightActions,
): NightRun {
  const context = createGame(presetName);
  const state = context.getGameState();
  return playScenarioNight(context, {
    ...createPresetChoices(state),
    ...vary(findRoleSeat(state, targetRole)),
  });
}

function playThiefCupid(context: GameContext, chosenRole: 'idiot' | 'villager'): NightRun {
  const state = context.getGameState();
  const seerSeat = findRoleSeat(state, 'seer');
  const villagers = getPlayers(state)
    .filter((player) => player.role === 'villager')
    .map((player) => player.seat);
  const firstVillager = requireSeat(villagers, 0);
  const tookIdiot = chosenRole === 'idiot';
  return playScenarioNight(context, {
    thief: { cardIndex: requireBottomCard(state, chosenRole) },
    cupid: {
      targets: tookIdiot
        ? [firstVillager, requireSeat(villagers, 1)]
        : [seerSeat, findRoleSeat(state, 'thief')],
    },
    wolf: tookIdiot ? seerSeat : firstVillager,
    witch: tookIdiot ? { save: seerSeat, poison: null } : null,
    seer: tookIdiot ? firstVillager : findRoleSeat(state, 'wolf'),
  });
}

function playTreasureMaster(seed: string, card: RoleId, poison: boolean): NightRun {
  const context = createGame(TREASURE_MASTER_ROLES, undefined, { randomSeed: seed });
  const state = context.getGameState();
  const villager = findRoleSeat(state, 'villager');
  return playScenarioNight(context, {
    treasureMaster: { cardIndex: requireBottomCard(state, card) },
    dreamcatcher: villager,
    crow: villager,
    wolf: null,
    poisoner: poison ? villager : null,
    psychic: findRoleSeat(state, 'wolf'),
  });
}

/** Deal bottom cards deterministically until `card` is one of them. */
function createGameWithBottomCard(roles: RoleId[], card: RoleId): GameContext {
  for (let attempt = 1; attempt <= BOTTOM_CARD_SEED_SEARCH_LIMIT; attempt += 1) {
    const context = createGame(roles, undefined, { randomSeed: `bottom-fixture-${attempt}` });
    if (context.getGameState().bottomCards?.includes(card) === true) return context;
  }
  throw new Error(`[FAIL-FAST] No fixture seed deals ${card} as a bottom card`);
}

function playPoisonedTreasureMaster(card: RoleId): NightRun {
  const context = createGameWithBottomCard(TREASURE_MASTER_WITCHER_ROLES, card);
  const state = context.getGameState();
  return playScenarioNight(context, {
    treasureMaster: { cardIndex: requireBottomCard(state, card) },
    wolf: null,
    poisoner: findRoleSeat(state, 'treasureMaster'),
    psychic: findRoleSeat(state, 'treasureMaster'),
  });
}

const CASES: readonly NightCase[] = [
  ...PRESET_TEMPLATES.map((preset) => ({
    name: `${preset.name} preset: ordinary night`,
    play: () => {
      const context = createGame(preset.name, undefined, { randomSeed: BOTTOM_CARD_SEED });
      return playScenarioNight(context, createPresetChoices(context.getGameState()));
    },
  })),
  ...NIGHT_SCENARIOS.map((scenario) => ({
    name: scenario.name,
    play: () => {
      const assignment = new Map(scenario.roles.map((roleId, seat) => [seat, roleId]));
      const context = createGame([...scenario.roles], assignment, {
        witchCanSelfHeal: scenario.witchCanSelfHeal ?? false,
      });
      return playScenarioNight(context, scenario.choices, scenario.randomSeed);
    },
  })),
  {
    name: '盗贼丘比特 preset: thief must take the wolf card',
    play: () => {
      const preset = PRESET_TEMPLATES.find((candidate) => candidate.name === '盗贼丘比特');
      if (preset === undefined) throw new Error('[FAIL-FAST] Missing the thief preset');
      const context = createGameWithBottomCard([...preset.roles], 'wolf');
      return playScenarioNight(context, createPresetChoices(context.getGameState()));
    },
  },
  ...(['idiot', 'villager'] as const).map((chosenRole) => ({
    name: `盗贼丘比特 preset: thief takes the ${chosenRole} card`,
    play: () =>
      playThiefCupid(
        createGame('盗贼丘比特', undefined, { randomSeed: BOTTOM_CARD_SEED }),
        chosenRole,
      ),
  })),
  ...(
    [
      { seed: 'bottom-fixture-9', card: 'crow', poison: false },
      { seed: 'bottom-fixture-9', card: 'villager', poison: false },
      { seed: 'bottom-fixture-2', card: 'dreamcatcher', poison: false },
      { seed: 'bottom-fixture-2', card: 'villager', poison: true },
    ] as const
  ).map(({ seed, card, poison }) => ({
    name: `treasure master: ${seed} takes the ${card} card${poison ? ' and the poisoner poisons' : ''}`,
    play: () => playTreasureMaster(seed, card, poison),
  })),
  ...(['witcher', 'villager'] as const).map((card) => ({
    name: `treasure master: poisoned after taking the ${card} card`,
    play: () => playPoisonedTreasureMaster(card),
  })),
  {
    name: '恶灵骑士 preset: seer checks the spirit knight',
    play: () => playPresetVariant('恶灵骑士', 'spiritKnight', (seat) => ({ seer: seat })),
  },
  {
    name: '恶灵骑士 preset: witch poisons the spirit knight',
    play: () =>
      playPresetVariant('恶灵骑士', 'spiritKnight', (seat) => ({
        witch: { save: null, poison: seat },
      })),
  },
  {
    name: '咒狐乌鸦 preset: seer checks the cursed fox',
    play: () => playPresetVariant('咒狐乌鸦', 'cursedFox', (seat) => ({ seer: seat })),
  },
];

/** Every night of the suite. A night is played once and remembered for later readers. */
export const NIGHT_CASES: readonly NightCase[] = CASES.map((nightCase) => {
  let run: NightRun | null = null;
  return {
    name: nightCase.name,
    play: () => {
      run ??= nightCase.play();
      return run;
    },
  };
});
