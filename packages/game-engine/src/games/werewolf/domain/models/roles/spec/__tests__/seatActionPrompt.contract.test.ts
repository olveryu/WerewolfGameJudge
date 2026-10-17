/**
 * Seat-action prompt contract.
 *
 * The canonical chooseSeat sentence pattern («请选择要{verb}的{target}，
 * 如不使用请点击「不用技能」» + «{verb}此玩家？» + «不用技能») is composed
 * by the one resolver (resolveSeatActionUi in schemas.ts) from a
 * structured `seatAction` declaration. This contract pins:
 * - the resolver's composition, including its fail-fast on coexistence
 *   with the literal fields it composes;
 * - the migrated steps' resolved text, byte-identical to the literals
 *   they replaced (snapshot taken before the migration);
 * - that the migrated steps declare `seatAction` (and no literals) in
 *   their specs, and that no other schema re-types the full canonical
 *   sentence set literally — a new literal copy fails here.
 */

import {
  getAllRoleIds,
  getRoleSpec,
  type SchemaId,
  SCHEMAS,
} from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec';
import { resolveSeatActionUi } from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec/schemas';

/** stepId → (verb, target) for every step migrated to the structured form. */
const MIGRATED: ReadonlyArray<{
  readonly stepId: SchemaId;
  readonly verb: string;
  readonly target: string;
}> = [
  { stepId: 'mirrorSeerCheck', verb: '查验', target: '玩家' },
  { stepId: 'drunkSeerCheck', verb: '查验', target: '玩家' },
  { stepId: 'seerCheck', verb: '查验', target: '玩家' },
  { stepId: 'poisonerPoison', verb: '毒杀', target: '玩家' },
  { stepId: 'guardProtect', verb: '守护', target: '玩家' },
  { stepId: 'psychicCheck', verb: '通灵', target: '玩家' },
  { stepId: 'dreamcatcherDream', verb: '摄梦', target: '玩家' },
  { stepId: 'pureWhiteCheck', verb: '查验', target: '玩家' },
  { stepId: 'silenceElderSilence', verb: '禁言', target: '玩家' },
  { stepId: 'votebanElderBan', verb: '禁票', target: '玩家' },
  { stepId: 'crowCurse', verb: '诅咒', target: '玩家' },
  { stepId: 'wolfQueenCharm', verb: '魅惑', target: '玩家' },
  { stepId: 'nightmareBlock', verb: '恐惧', target: '玩家' },
  { stepId: 'gargoyleCheck', verb: '查验', target: '玩家' },
  { stepId: 'wolfRobotLearn', verb: '学习', target: '玩家' },
  { stepId: 'wolfWitchCheck', verb: '查验', target: '非狼人阵营玩家' },
  { stepId: 'eclipseWolfQueenShelter', verb: '放逐', target: '玩家' },
];

const CANONICAL_PROMPT = /^请选择要(.+?)的(.+?)，如不使用请点击「不用技能」$/;

describe('resolveSeatActionUi', () => {
  it('composes the canonical sentence set from a verb with the default target', () => {
    expect(resolveSeatActionUi({ seatAction: { verb: '查验' } })).toEqual({
      prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
      confirmText: '查验此玩家？',
      bottomActionText: '不用技能',
    });
  });

  it('composes with a custom target noun and keeps unrelated fields', () => {
    expect(
      resolveSeatActionUi({
        seatAction: { verb: '查验', target: '非狼人阵营玩家' },
        confirmTitle: '确认查验',
        revealTitlePrefix: '查验结果',
      }),
    ).toEqual({
      confirmTitle: '确认查验',
      revealTitlePrefix: '查验结果',
      prompt: '请选择要查验的非狼人阵营玩家，如不使用请点击「不用技能」',
      confirmText: '查验此玩家？',
      bottomActionText: '不用技能',
    });
  });

  it('passes a literal ui through untouched when no seatAction is declared', () => {
    const literal = { prompt: '请点击玩家座位，选择今晚的袭击目标', confirmTitle: '狼人投票' };
    expect(resolveSeatActionUi(literal)).toEqual(literal);
  });

  it.each(['prompt', 'confirmText', 'bottomActionText'] as const)(
    'fails fast when seatAction coexists with a literal %s',
    (field) => {
      expect(() => resolveSeatActionUi({ seatAction: { verb: '查验' }, [field]: 'x' })).toThrow(
        '[schemas] seatAction must not coexist with literal prompt/confirmText/bottomActionText',
      );
    },
  );
});

describe('seat-action migration', () => {
  it.each(MIGRATED)(
    '$stepId resolves byte-identically to its pre-migration literals',
    ({ stepId, verb, target }) => {
      const ui = SCHEMAS[stepId].ui ?? {};
      expect(ui.prompt).toBe(`请选择要${verb}的${target}，如不使用请点击「不用技能」`);
      expect(ui.confirmText).toBe(`${verb}此玩家？`);
      expect(ui.bottomActionText).toBe('不用技能');
    },
  );

  it('every migrated step declares seatAction in its spec and no composed literals', () => {
    const declared = new Map<string, { verb: string; target?: string }>();
    for (const roleId of getAllRoleIds()) {
      const spec = getRoleSpec(roleId);
      for (const step of spec.nightSteps ?? []) {
        if (step.ui?.seatAction) declared.set(step.stepId, step.ui.seatAction);
      }
    }
    expect([...declared.keys()].sort()).toEqual(MIGRATED.map((m) => m.stepId).sort());
    for (const { stepId, verb, target } of MIGRATED) {
      const seatAction = declared.get(stepId);
      expect(seatAction?.verb).toBe(verb);
      expect(seatAction?.target ?? '玩家').toBe(target);
    }
  });

  it('no other schema re-types the full canonical sentence set literally', () => {
    // The guard targets the full set (prompt + confirmText +
    // bottomActionText). A prompt that merely shares the shell but
    // pairs with a different confirm — magicianSwap's dual-target
    // «交换这两名玩家？» — is a different pattern family, not a copy.
    const migratedIds = new Set<string>(MIGRATED.map((m) => m.stepId));
    const offenders: string[] = [];
    const check = (
      label: string,
      ui: { prompt?: string; confirmText?: string; bottomActionText?: string },
    ) => {
      const match = ui.prompt !== undefined ? CANONICAL_PROMPT.exec(ui.prompt) : null;
      if (match === null) return;
      const verb = match[1];
      if (ui.confirmText === `${verb}此玩家？` && ui.bottomActionText === '不用技能') {
        offenders.push(label);
      }
    };
    for (const [id, schema] of Object.entries(SCHEMAS)) {
      if (migratedIds.has(id)) continue;
      if (schema.ui) check(id, schema.ui);
      if (schema.kind === 'compound') {
        for (const sub of schema.steps) {
          if (sub.ui) check(`${id}/${sub.key}`, sub.ui);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
