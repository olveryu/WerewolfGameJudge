/**
 * FibRoleCardAdapter - 把 FibRoundView 转成共享 RevealRoleData。
 *
 * 可见性由服务端裁剪（FibRoundView 已按 viewer 权限给/不给 definition），
 * 本 adapter 只做展示映射，不做权限判断：
 * - 身份全部显示（产品裁决）：大聪明/老实人/瞎掰王、观战、已结束公开结果。
 * - alignment 与 BoardInfo 定色一致：大聪明 god、老实人 villager、瞎掰王 wolf；
 *   无身份（观战/已结束无角色）为 neutral。
 */
import type { FibRoundView } from '@game-judge/game-engine/games/fibking/public';

import type {
  DescriptionField,
  RevealAlignment,
  RevealRoleData,
} from '@/features/room/model/RevealRoleData';
import { formatRoomSeat } from '@/features/room/model/RoomSeatDataSource';
import { TESTIDS } from '@/testids';

import { getFibRoleName } from '../fibRoomAdapter';
import { formatFibWordPinyin } from '../formatFibWordPinyin';

function getRoleInstruction(view: FibRoundView): string {
  if (view.phase === 'ended') return '本轮身份与真实释义已经公开。';
  if (view.viewerRole === null) {
    return view.phase === 'viewing'
      ? '观战时可以查看本轮词语；真实释义将在公布答案时揭晓。'
      : '观战时可以查看本轮词语和真实释义。';
  }
  switch (view.viewerRole) {
    case 'guesser':
      return '听取其他玩家的描述，找出真实释义。';
    case 'honest':
      return '用自己的话描述真实释义，不能直接念出答案。';
    case 'fibber':
      return '编出可信的释义，让大聪明难以分辨。';
  }
}

function getAlignment(view: FibRoundView): RevealAlignment {
  switch (view.viewerRole) {
    case 'guesser':
      return 'god';
    case 'honest':
      return 'villager';
    case 'fibber':
      return 'wolf';
    case null:
      return 'neutral';
  }
}

export function toFibRevealRoleData(view: FibRoundView): RevealRoleData {
  const isSpectator = view.phase !== 'ended' && view.viewerRole === null;
  const roleName =
    view.phase === 'ended'
      ? '公开结果'
      : view.viewerRole === null
        ? '观战视角'
        : getFibRoleName(view.viewerRole);
  const eyebrow = view.phase === 'ended' ? '本轮结果' : isSpectator ? '本轮题目' : '你的身份';

  const fields: DescriptionField[] = [
    { label: '角色说明', content: getRoleInstruction(view), icon: 'information-circle-outline' },
    {
      label: '本轮词语',
      content: view.word,
      icon: 'book-outline',
      contentTestID: TESTIDS.fibIdentityWord,
    },
  ];
  const wordPinyin = formatFibWordPinyin(view.word);
  if (wordPinyin !== null) {
    fields.push({
      label: '拼音',
      content: wordPinyin,
      icon: 'language-outline',
      contentTestID: TESTIDS.fibIdentityPinyin,
    });
  }
  if (view.definition !== null) {
    fields.push({
      label: '核心释义',
      content: view.definition.coreMeaning,
      icon: 'bulb-outline',
      testID: TESTIDS.fibIdentityDefinition,
      contentTestID: TESTIDS.fibIdentityCoreMeaning,
    });
    fields.push({
      label: '使用提示',
      content: view.definition.usageNote,
      icon: 'help-circle-outline',
      contentTestID: TESTIDS.fibIdentityUsageNote,
    });
  }
  const assignments = [`${formatRoomSeat(view.guesserSeat)} · 大聪明`];
  if (view.honestSeat !== null) {
    assignments.push(`${formatRoomSeat(view.honestSeat)} · 老实人`);
    assignments.push('其余座位 · 瞎掰王');
  }
  fields.push({ label: '公开身份', content: assignments.join('；'), icon: 'people-outline' });

  return {
    id: 'fibking-identity',
    name: roleName,
    alignment: getAlignment(view),
    factionName: eyebrow,
    description: fields,
  };
}

/**
 * Animator 计数池（身份查看协议）：只有种类与计数——大聪明 1、老实人 1、
 * 其余为瞎掰王。不含任何座位信息，零泄密。
 */
export function getFibRevealRolePool(playerCount: number): readonly RevealRoleData[] {
  const pool: RevealRoleData[] = [
    { id: 'fibking-guesser', name: getFibRoleName('guesser'), alignment: 'god' },
    { id: 'fibking-honest', name: getFibRoleName('honest'), alignment: 'villager' },
  ];
  for (let index = 0; index < playerCount - 2; index += 1) {
    pool.push({ id: 'fibking-fibber', name: getFibRoleName('fibber'), alignment: 'wolf' });
  }
  return pool;
}
