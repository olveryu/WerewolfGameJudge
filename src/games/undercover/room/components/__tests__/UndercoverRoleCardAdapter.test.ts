/**
 * UndercoverRoleCardAdapter — BoardInfo 角色预览数据（批：BoardInfo 角色预览）。
 * 文案来源是规则页（UndercoverRulesScreen），本测试把 adapter 的三份文案钉成
 * 字面值防漂移；与规则页原文的一致性由 QA/评审在改文案时双向核对。
 */
import { isUndercoverRole, toUndercoverRolePreviewData } from '../UndercoverRoleCardAdapter';

describe('toUndercoverRolePreviewData', () => {
  it('builds the civilian preview with rules-page copy', () => {
    expect(toUndercoverRolePreviewData('civilian')).toEqual({
      id: 'undercover-civilian',
      name: '平民',
      alignment: 'villager',
      description: [
        {
          label: '角色说明',
          content: '与其他平民拿到相同的词，词卡不显示所属阵营。找出拿到不同词语的玩家。',
          icon: 'information-circle-outline',
        },
        {
          label: '胜利条件',
          content: '没有存活白板，且卧底全部出局。',
          icon: 'trophy-outline',
        },
      ],
    });
  });

  it('builds the undercover preview with rules-page copy', () => {
    expect(toUndercoverRolePreviewData('undercover')).toEqual({
      id: 'undercover-undercover',
      name: '卧底',
      alignment: 'wolf',
      description: [
        {
          label: '角色说明',
          content:
            '拿到与平民相关但不同的词，词卡同样不显示所属阵营。通过描述判断局势，避免被投出。',
          icon: 'information-circle-outline',
        },
        {
          label: '胜利条件',
          content: '没有存活白板，且存活卧底人数不少于存活平民人数。',
          icon: 'trophy-outline',
        },
      ],
    });
  });

  it('builds the blank preview with rules-page copy', () => {
    expect(toUndercoverRolePreviewData('blank')).toEqual({
      id: 'undercover-blank',
      name: '白板',
      alignment: 'neutral',
      description: [
        {
          label: '角色说明',
          content: '没有词语，但知道自己是白板。根据其他人的描述寻找线索，争取留到最后。',
          icon: 'information-circle-outline',
        },
        {
          label: '胜利条件',
          content: '白板存活且场上只剩两人时，白板独赢。白板仍在且超过两人时，继续游戏。',
          icon: 'trophy-outline',
        },
      ],
    });
  });
});

describe('isUndercoverRole', () => {
  it('accepts the three role ids and rejects anything else', () => {
    expect(isUndercoverRole('civilian')).toBe(true);
    expect(isUndercoverRole('undercover')).toBe(true);
    expect(isUndercoverRole('blank')).toBe(true);
    expect(isUndercoverRole('fibber')).toBe(false);
    expect(isUndercoverRole('')).toBe(false);
  });
});
