/**
 * Secrethitler identity copy shared by the role card and the rules screen.
 */
import type { DescriptionField, RevealRoleData } from '@/features/room/model/RevealRoleData';

import { getRoleAvatar } from '../assets/roleAvatars';

export interface SecrethitlerRoleDetails {
  readonly id: string;
  readonly name: string;
  readonly alignment: 'villager' | 'wolf';
  readonly factionName: string;
  readonly guideDescription: string;
  readonly description: readonly DescriptionField[];
}

export const SECRETHITLER_ROLE_DETAILS: readonly SecrethitlerRoleDetails[] = [
  {
    id: 'liberal',
    name: '自由派',
    alignment: 'villager',
    factionName: '自由派',
    guideDescription: '你只知道自己的身份。与其他玩家讨论并推理阵营，推动自由派政策或找出希特勒。',
    description: [
      { label: '胜利条件', content: '施行 5 张自由派政策，或处决希特勒。' },
      { label: '首夜信息', content: '只知道自己的身份，不会获知其他玩家的身份。' },
    ],
  },
  {
    id: 'fascist',
    name: '法西斯',
    alignment: 'wolf',
    factionName: '法西斯阵营',
    guideDescription:
      '你的目标是帮助法西斯获胜。5–6 人局会与希特勒互认；7–10 人局的普通法西斯彼此认识，也知道希特勒是谁。',
    description: [
      {
        label: '胜利条件',
        content: '施行 6 张法西斯政策，或让希特勒在法西斯政策达到 3 张后当选总理。',
      },
      {
        label: '首夜信息',
        content: '互认范围由人数决定；应用会私下显示获准知道的法西斯阵营座位。',
      },
    ],
  },
  {
    id: 'hitler',
    name: '希特勒',
    alignment: 'wolf',
    factionName: '法西斯阵营',
    guideDescription:
      '你的目标与法西斯阵营一致。5–6 人局会与普通法西斯互认；7–10 人局不知道其他法西斯是谁。',
    description: [
      {
        label: '胜利条件',
        content: '施行 6 张法西斯政策，或在法西斯政策达到 3 张后当选总理。',
      },
      {
        label: '首夜信息',
        content: '5–6 人局能识别普通法西斯；7–10 人局不会获知其他法西斯玩家身份。',
      },
    ],
  },
];

/** Converts one game identity into the shared role-card presentation model. */
export function toRevealRoleData(identity: string): RevealRoleData {
  const role = SECRETHITLER_ROLE_DETAILS.find((candidate) => candidate.id === identity);
  if (role === undefined) {
    throw new Error(`[FAIL-FAST] Unknown Secret Hitler identity: ${identity}`);
  }
  return {
    id: role.id,
    name: role.name,
    alignment: role.alignment,
    imageUrl: getRoleAvatar(identity),
    factionName: role.factionName,
    description: role.description,
  };
}

/** Returns the public display name used for a revealed identity. */
export function getSecrethitlerIdentityName(identity: string): string {
  return toRevealRoleData(identity).name;
}
