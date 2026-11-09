import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { getAllSchemaIds, getSchema } from '@game-judge/game-engine/games/werewolf/public';

import { actorStep, mountRoomFor } from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

// Keep this list in sync with `schemas.smoke.contract.test.ts`.
const schemaToRole: Record<string, RoleId> = {
  // god
  seerCheck: 'seer',
  mirrorSeerCheck: 'mirrorSeer',
  drunkSeerCheck: 'drunkSeer',
  guardProtect: 'guard',
  psychicCheck: 'psychic',
  pureWhiteCheck: 'pureWhite',
  dreamcatcherDream: 'dreamcatcher',
  magicianSwap: 'magician',
  hunterConfirm: 'hunter',
  witchAction: 'witch',
  silenceElderSilence: 'silenceElder',
  votebanElderBan: 'votebanElder',
  crowCurse: 'crow',
  poisonerPoison: 'poisoner',

  // wolf
  wolfKill: 'wolf',
  wolfQueenCharm: 'wolfQueen',
  nightmareBlock: 'nightmare',
  gargoyleCheck: 'gargoyle',
  awakenedGargoyleConvert: 'awakenedGargoyle',
  awakenedGargoyleConvertReveal: 'awakenedGargoyle',
  wolfWitchCheck: 'wolfWitch',
  wolfRobotLearn: 'wolfRobot',
  darkWolfKingConfirm: 'darkWolfKing',
  eclipseWolfQueenShelter: 'eclipseWolfQueen',
  hiddenWolfReveal: 'hiddenWolf',
  seedWolfInfect: 'seedWolf',
  seedWolfInfectReveal: 'seedWolf',
  wolfGirlConfess: 'wolfGirl',
  wolfGirlConfessReveal: 'wolfGirl',

  // third party
  slackerChooseIdol: 'slacker',
  wildChildChooseIdol: 'wildChild',
  shadowChooseMimic: 'shadow',
  avengerConfirm: 'avenger',
  piperHypnotize: 'piper',
  piperHypnotizedReveal: 'piper',
  treasureMasterChoose: 'treasureMaster',
  thiefChoose: 'thief',
  cupidChooseLovers: 'cupid',
  cupidLoversReveal: 'cupid',
};

function roleForSchemaId(schemaId: string): RoleId {
  const role = schemaToRole[schemaId];
  if (!role) {
    throw new Error(`[schemas.smoke.ui] Missing role mapping for schemaId: ${schemaId}`);
  }
  return role;
}

describe('WerewolfRoomScreen schema smoke (one-per-schema)', () => {
  it.each(getAllSchemaIds())('renders schema: %s', async (schemaId) => {
    const schema = getSchema(schemaId);
    const role = roleForSchemaId(schemaId);

    // Server facts the step needs on the wire before the actor can act.
    const gameStateOverrides: Partial<GameState> = {};
    if (schemaId === 'witchAction') {
      gameStateOverrides.witchContext = { killedSeat: 2, canSave: true, canPoison: true };
    }
    if (schema.kind === 'chooseCard') {
      gameStateOverrides.bottomCards = ['wolf', 'villager', 'seer'];
    }

    const view = await mountRoomFor({ ...actorStep(schemaId, role, 0), gameStateOverrides });

    // Key-copy assertion: the actor's bottom message carries the schema prompt
    // (the wolf vote appends its status line after it).
    const prompt = schema.ui?.prompt;
    if (typeof prompt !== 'string' || !prompt) {
      throw new Error(`[schemas.smoke.ui] Missing rendered text for schema: ${schemaId}`);
    }
    expect(await view.findByText(prompt, { exact: false })).toBeInTheDocument();
  });
});
