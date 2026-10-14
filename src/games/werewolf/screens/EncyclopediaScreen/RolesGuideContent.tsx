/**
 * RolesGuideContent — 狼人杀图鉴「角色」段绑定。
 *
 * 列表/筛选/搜索/详情机器都是共享件（@/features/encyclopedia），
 * 本文件只注入狼人杀数据源与 AI 攻略 pill 插槽。状态由壳层
 * （EncyclopediaScreen 绑定）持有并以 props 传入。
 */
import type React from 'react';
import { useCallback } from 'react';

import { EncyclopediaRolesContent } from '@/features/encyclopedia/EncyclopediaRolesContent';
import type { EncyclopediaRoleEntry } from '@/features/encyclopedia/encyclopediaSource';
import type { EncyclopediaRolesState } from '@/features/encyclopedia/useEncyclopediaRolesState';

import { WEREWOLF_ENCYCLOPEDIA_SOURCE } from './werewolfEncyclopediaSource';
import { WerewolfRoleDetailExtra } from './WerewolfRoleDetailExtra';

// ── Props ─────────────────────────────────────────────────────────────────────

interface RolesGuideContentProps {
  state: EncyclopediaRolesState;
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Role guide content area (werewolf binding over the shared encyclopedia). */
export const RolesGuideContent: React.FC<RolesGuideContentProps> = ({ state }) => {
  const renderDetailExtra = useCallback(
    (entry: EncyclopediaRoleEntry, onClose: () => void) => (
      <WerewolfRoleDetailExtra entry={entry} onClose={onClose} />
    ),
    [],
  );

  return (
    <EncyclopediaRolesContent
      source={WEREWOLF_ENCYCLOPEDIA_SOURCE}
      state={state}
      roleDetailHeaderExtra={renderDetailExtra}
    />
  );
};
