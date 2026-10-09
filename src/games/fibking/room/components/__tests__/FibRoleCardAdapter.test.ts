/**
 * FibRoleCardAdapter — BoardInfo 角色预览数据（批：BoardInfo 角色预览）。
 * 预览只含种类级信息（名称/阵营/角色说明），绝不带本轮词语与释义，
 * 且与身份卡的角色说明共用同一文案来源。
 */
import type { DescriptionField } from '@/features/room/model/RevealRoleData';

import { getFibRoleInstruction, isFibRole, toFibRolePreviewData } from '../FibRoleCardAdapter';

function previewFields(role: 'guesser' | 'honest' | 'fibber'): readonly DescriptionField[] {
  const description = toFibRolePreviewData(role).description;
  if (typeof description === 'string' || description === undefined)
    throw new Error('Preview description must be structured fields');
  return description;
}

describe('toFibRolePreviewData', () => {
  it('builds kind-level preview data for all three roles', () => {
    expect(toFibRolePreviewData('guesser')).toEqual({
      id: 'fibking-guesser',
      name: '大聪明',
      alignment: 'god',
      description: [
        {
          label: '角色说明',
          content: '听取其他玩家的描述，找出真实释义。',
          icon: 'information-circle-outline',
        },
      ],
    });
    expect(toFibRolePreviewData('honest')).toEqual({
      id: 'fibking-honest',
      name: '老实人',
      alignment: 'villager',
      description: [
        {
          label: '角色说明',
          content: '用自己的话描述真实释义，不能直接念出答案。',
          icon: 'information-circle-outline',
        },
      ],
    });
    expect(toFibRolePreviewData('fibber')).toEqual({
      id: 'fibking-fibber',
      name: '瞎掰王',
      alignment: 'wolf',
      description: [
        {
          label: '角色说明',
          content: '编出可信的释义，让大聪明难以分辨。',
          icon: 'information-circle-outline',
        },
      ],
    });
  });

  it('never leaks round word or definition fields into the preview', () => {
    for (const role of ['guesser', 'honest', 'fibber'] as const) {
      expect(previewFields(role).map((field) => field.label)).toEqual(['角色说明']);
    }
  });

  it('shares the instruction copy with the identity card source', () => {
    for (const role of ['guesser', 'honest', 'fibber'] as const) {
      expect(previewFields(role)[0]?.content).toBe(getFibRoleInstruction(role));
    }
  });
});

describe('isFibRole', () => {
  it('accepts the three role ids and rejects anything else', () => {
    expect(isFibRole('guesser')).toBe(true);
    expect(isFibRole('honest')).toBe(true);
    expect(isFibRole('fibber')).toBe(true);
    expect(isFibRole('werewolf')).toBe(false);
    expect(isFibRole('')).toBe(false);
  });
});
