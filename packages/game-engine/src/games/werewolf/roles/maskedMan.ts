import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import type { DeathResolution } from './deathEffects';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '蒙面人',
  shortName: '蒙',
  description:
    '首次在夜晚因狼人袭击、毒杀或摄梦连带受到致命伤害时负伤免死，转为负伤状态而非出局；进入负伤状态后，于下一次白天自己发言结束后强制出局',
  triggerText: '首次在夜晚因狼人袭击、毒杀或摄梦连带受到致命伤害时负伤免死，转为负伤状态而非出局',
  restrictionText: '进入负伤状态后，于下一次白天自己发言结束后强制出局',
  viewLabel: '查看负伤状态',
  viewPrompt: '请在自己发言结束后再查看',
  viewTitle: '负伤状态',
  wounded: '你已负伤，请宣布出局',
  notWounded: '你没有负伤',
  woundedReview: '{seat}蒙面人负伤，次日发言后出局',
});

/** The masked man is only wounded by these; any other cause of death takes him at dawn. */
const MASKED_MAN_WOUND_CAUSES = ['wolfKill', 'poison', 'dreamcatcherLink'] as const;

function isWounded(seat: number, resolution: DeathResolution): boolean {
  return resolution.trace.some((entry) => entry.kind === 'wound' && entry.target === seat);
}

export const maskedMan = createPassiveRole(
  'maskedMan',
  {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🥷',
    description: COPY.description,
    sections: { trigger: COPY.triggerText, restriction: COPY.restrictionText },
    tags: ['immune'],
  },
  {
    faction: 'god',
    team: 'good',
  },
  (_context, seat) => [{ kind: 'wound', seat, against: MASKED_MAN_WOUND_CAUSES }],
  {
    label: COPY.viewLabel,
    prompt: COPY.viewPrompt,
    title: COPY.viewTitle,
    content: (seat, resolution) => (isWounded(seat, resolution) ? COPY.wounded : COPY.notWounded),
    reviewLine: (seat, resolution) =>
      isWounded(seat, resolution)
        ? renderCopy(COPY.woundedReview, { seat: formatSeat(seat) })
        : null,
  },
);
