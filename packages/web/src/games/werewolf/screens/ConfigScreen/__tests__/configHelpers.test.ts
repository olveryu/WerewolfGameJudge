/** configHelpers: row one-liners come from the role spec, tray tokens mirror the draft. */
import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';

import {
  buildInitialSelection,
  FACTION_GROUPS,
} from '@/games/werewolf/screens/ConfigScreen/configData';
import {
  buildBoardTrayTokens,
  filterConfigListGroups,
  getFactionGroupSelectedCount,
  getFactionGroupSlotCount,
  getRoleOneLiner,
} from '@/games/werewolf/screens/ConfigScreen/configHelpers';

describe('getRoleOneLiner', () => {
  it('uses the structured skill clause when the role has one', () => {
    expect(getRoleOneLiner('seer')).toBe('每晚可查验一名玩家的阵营，获知其是好人还是狼人');
    expect(getRoleOneLiner('witch')).toBe(
      '拥有一瓶解药和一瓶毒药；每晚可救活被狼人袭击的玩家或毒杀一名玩家',
    );
  });

  it('falls back to the first description clause when the role has no skill clause', () => {
    expect(getRoleOneLiner('villager')).toBe('没有特殊技能，依靠推理和投票帮助好人阵营获胜');
  });

  it('returns a one-liner for every role in the pool', () => {
    for (const roleId of Object.keys(ROLE_SPECS)) {
      expect(getRoleOneLiner(roleId as keyof typeof ROLE_SPECS)).not.toBe('');
    }
  });
});

describe('faction group counts', () => {
  it('counts selected copies and slot totals per group', () => {
    const selection = buildInitialSelection();
    const [goodGroup, wolfGroup, thirdGroup] = FACTION_GROUPS;
    if (goodGroup === undefined || wolfGroup === undefined || thirdGroup === undefined) {
      throw new Error('Missing faction group');
    }

    expect(getFactionGroupSelectedCount(selection, goodGroup)).toBe(8);
    expect(getFactionGroupSlotCount(goodGroup)).toBe(28);
    expect(getFactionGroupSelectedCount(selection, wolfGroup)).toBe(4);
    expect(getFactionGroupSlotCount(wolfGroup)).toBe(25);
    expect(getFactionGroupSelectedCount(selection, thirdGroup)).toBe(0);
    expect(getFactionGroupSlotCount(thirdGroup)).toBe(7);
  });
});

describe('buildBoardTrayTokens', () => {
  it('emits one token per selected slot, bulk slots as a ×count token', () => {
    const tokens = buildBoardTrayTokens(buildInitialSelection(), {});

    expect(tokens.map((token) => token.label)).toEqual([
      '平民×4',
      '预言家',
      '女巫',
      '猎人',
      '愚者',
      '狼人×4',
    ]);
    expect(tokens.map((token) => token.key)).toEqual([
      'villager3',
      'seer',
      'witch',
      'hunter',
      'idiot',
      'wolf3',
    ]);
  });

  it('shows the active variant label for a slot with a variant override', () => {
    const selection = buildInitialSelection();
    const tokens = buildBoardTrayTokens(selection, { witch: 'poisoner' });

    expect(tokens.find((token) => token.key === 'witch')).toMatchObject({
      label: '毒师',
      roleId: 'poisoner',
    });
  });

  it('emits no tokens for a blank board', () => {
    expect(buildBoardTrayTokens(buildInitialSelection([]), {})).toEqual([]);
  });
});

describe('filterConfigListGroups', () => {
  it('returns every group and section with no query and no filter', () => {
    const groups = filterConfigListGroups(buildInitialSelection(), {}, '', false);

    expect(groups.map((group) => group.title)).toEqual(['好人', '狼人', '第三方']);
    expect(groups.flatMap((group) => group.sections).map((section) => section.title)).toEqual([
      '平民',
      '神职',
      '特殊平民',
      '普通狼人',
      '技能狼',
      '第三方',
    ]);
    const godSection = groups[0]?.sections.find((section) => section.title === '神职');
    expect(godSection?.rows.map((row) => row.key)).toContain('seer');
    expect(godSection?.rows.find((row) => row.key === 'witch')).toMatchObject({
      label: '女巫',
      selected: true,
    });
  });

  it('matches by name or skill text', () => {
    const groups = filterConfigListGroups(buildInitialSelection(), {}, '查验', false);

    const keys = groups.flatMap((group) =>
      group.sections.flatMap((section) => section.rows.map((row) => row.key)),
    );
    expect(keys).toContain('seer');
    expect(keys).not.toContain('witch');
  });

  it('hides selected rows with the unpicked-only filter', () => {
    const groups = filterConfigListGroups(buildInitialSelection(), {}, '', true);

    const keys = groups.flatMap((group) =>
      group.sections.flatMap((section) => section.rows.map((row) => row.key)),
    );
    expect(keys).not.toContain('witch');
    expect(keys).toContain('nightmare');
    // Bulk rows hide only once fully selected.
    expect(
      groups.flatMap((group) => group.sections).some((section) => section.bulkRoleId === 'wolf'),
    ).toBe(true);
  });

  it('drops groups with no matching rows', () => {
    const groups = filterConfigListGroups(buildInitialSelection(), {}, '女巫', false);

    expect(groups.map((group) => group.title)).toEqual(['好人']);
  });
});
