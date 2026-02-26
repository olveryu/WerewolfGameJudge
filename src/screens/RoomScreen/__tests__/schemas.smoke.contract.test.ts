import { getAllSchemaIds } from '@werewolf/game-engine/models/roles/spec/schemas';

// Keep this list in sync with `schemas.smoke.ui.test.tsx`.
//
// Why a contract test?
// The UI smoke suite runs one test per schemaId, but it depends on a
// schemaId -> roleId mapping. When a new schema is added, forgetting to add a
// mapping yields a confusing runtime failure in the middle of the UI test.
// This contract test makes that failure immediate and precise.

const schemaToRole: Record<string, string> = {
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
  witchSave: 'witch',
  witchPoison: 'witch',
  witchAction: 'witch',
  silenceElderSilence: 'silenceElder',
  votebanElderBan: 'votebanElder',

  // wolf
  wolfKill: 'wolf',
  wolfQueenCharm: 'wolfQueen',
  nightmareBlock: 'nightmare',
  gargoyleCheck: 'gargoyle',
  wolfWitchCheck: 'wolfWitch',
  wolfRobotLearn: 'wolfRobot',
  darkWolfKingConfirm: 'darkWolfKing',

  // third party
  slackerChooseIdol: 'slacker',
  wildChildChooseIdol: 'wildChild',
  piperHypnotize: 'piper',
  piperHypnotizedReveal: 'piper',
};

describe('RoomScreen schema smoke: schemaId->role mapping contract', () => {
  it('has a role mapping for every SchemaId', () => {
    const all = getAllSchemaIds();
    const missing = all.filter((id) => !schemaToRole[id]);
    expect(missing).toEqual([]);
  });
});
