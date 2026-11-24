import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import type { GameState } from '../domain/protocol/types';
import { getWerewolfRoleDefinition } from './nightPlan';
import type { WerewolfAnnouncementTiming } from './role';

const COPY = defineCopy({
  dawn: '天亮公布',
  daySpeech: '警下发言时公布',
  exileVote: '放逐投票时公布',
});

const TIMING_LABELS: Readonly<Record<WerewolfAnnouncementTiming, string>> = COPY;
const TIMING_ORDER: Readonly<Record<WerewolfAnnouncementTiming, number>> = {
  dawn: 0,
  daySpeech: 1,
  exileVote: 2,
};

export interface WerewolfDaytimeAnnouncement {
  readonly key: string;
  readonly title: string;
  readonly timing: WerewolfAnnouncementTiming;
  readonly timingLabel: string;
  readonly message: string;
}

/** Project declared public information from the settled night facts. */
export function getWerewolfDaytimeAnnouncements(
  state: GameState,
): readonly WerewolfDaytimeAnnouncement[] {
  const declaredRoles = [...new Set(state.templateRoles)].flatMap((roleId) => {
    const declaration = getWerewolfRoleDefinition(roleId).announcement;
    return declaration === undefined ? [] : [{ roleId, declaration }];
  });
  if (declaredRoles.length === 0) return [];
  if (state.nightState === null) {
    throw new Error('[FAIL-FAST] Daytime announcements require a settled night');
  }
  const selections = state.nightState.facts.selections;
  return declaredRoles
    .map(({ roleId, declaration }) => {
      const targets = selections.filter((selection) => selection.roleId === roleId);
      return {
        key: roleId,
        title: declaration.title,
        timing: declaration.timing,
        timingLabel: TIMING_LABELS[declaration.timing],
        message:
          targets.length === 0
            ? declaration.emptyMessage
            : targets
                .map((target) =>
                  renderCopy(declaration.targetMessage, { seat: formatSeat(target.landingSeat) }),
                )
                .join('\n'),
      };
    })
    .toSorted((left, right) => TIMING_ORDER[left.timing] - TIMING_ORDER[right.timing]);
}
