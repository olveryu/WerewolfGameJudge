import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import { defineWerewolfStepAudio } from './audio';
import { resolveTargetSelection } from './location';
import type { WerewolfNightFacts } from './role';
import { defineRole } from './role';
import { getRoleAbilityLockReason } from './roleSteps';

const COPY = defineCopy({
  name: '魔术师',
  shortName: '术',
  emoji: '🎩',
  description: '每晚最先行动，交换两名玩家的号码牌；交换仅当晚有效',
  stepTitle: '交换',
  prompt: '请选择要交换的两名玩家',
  action: '交换{first}和{second}',
});

export const magician = defineRole({
  id: 'magician',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
  },
  traits: { faction: 'god', team: 'good' },
  nightSchedule: 'everyNight',
  steps: [
    {
      id: 'magicianSwap',
      title: COPY.stepTitle,
      audio: defineWerewolfStepAudio('magician'),
      actors: (context) =>
        context.state.seatedSeats.filter((seat) =>
          context.role.activeRoleIdsOf(seat).includes('magician'),
        ),
      actions: [
        {
          kind: 'pickSeats',
          key: 'magicianSwap',
          name: COPY.stepTitle,
          count: { min: 2, max: 2 },
          prompt: COPY.prompt,
          seats: (context) =>
            context.state.seatedSeats.map((seat) => ({ seat, unavailableReason: null })),
          phrase: (seats) => {
            const first = seats[0];
            const second = seats[1];
            if (first === undefined || second === undefined) return COPY.stepTitle;
            return renderCopy(COPY.action, {
              first: formatSeat(first),
              second: formatSeat(second),
            });
          },
          resolve: (context, [firstSeat, secondSeat]) => {
            if (
              firstSeat === undefined ||
              secondSeat === undefined ||
              firstSeat === secondSeat ||
              context.seat === null
            ) {
              throw new Error('[FAIL-FAST] Magician must swap two distinct players');
            }
            const first = resolveTargetSelection(firstSeat, { swap: null });
            const second = resolveTargetSelection(secondSeat, { swap: null });
            const swap = { first: first.landingSeat, second: second.landingSeat };
            const facts: WerewolfNightFacts = {
              selections: [
                { roleId: 'magician', actorSeat: context.seat, ...first },
                { roleId: 'magician', actorSeat: context.seat, ...second },
              ],
              identityChanges: [],
              cardSelections: [],
              disabledAbilities: [],
              deathEffects: [],
              locationSwaps: [swap],
            };
            return { facts };
          },
        },
      ],
      skippable: () => true,
      lock: (context) => getRoleAbilityLockReason(context, 'magician'),
      reviewSubject: () => COPY.name,
    },
  ],
});
