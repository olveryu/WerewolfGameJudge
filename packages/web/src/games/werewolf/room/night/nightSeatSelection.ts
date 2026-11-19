import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import type { NightConfirmation } from './buildNightCommand';
import type { NightInteractionModel } from './NightInteractionModel';

export function nightSeatAction(model: NightInteractionModel) {
  switch (model.kind) {
    case 'pickSeat':
      return {
        label: model.actionLabel.startsWith('选择')
          ? model.actionLabel
          : `选择${model.actionLabel}目标`,
        verb: `确认${model.actionLabel}`,
        eligible: model.selectable,
        min: 1,
        max: 1,
      };
    case 'wolfVote':
      return model.emptyVoteOnly
        ? null
        : { label: '选择袭击目标', verb: '确认袭击', eligible: model.selectable, min: 1, max: 1 };
    case 'witch':
      return model.canPoison
        ? { label: '选择毒药目标', verb: '确认毒杀', eligible: model.selectable, min: 1, max: 1 }
        : null;
    case 'pickTwoSeats':
      return {
        label: '选择交换对象',
        verb: '确认交换',
        eligible: model.selectable,
        min: 2,
        max: 2,
      };
    case 'multiSelect':
      return {
        label: model.actionLabel === '连接情侣' ? '选择情侣' : `选择${model.actionLabel}目标`,
        verb: `确认${model.actionLabel}`,
        eligible: model.selectable,
        min: model.min,
        max: model.max,
      };
    default:
      return null;
  }
}

export interface NightSeatSelection {
  readonly eligible: readonly number[];
  readonly seats: readonly number[];
  readonly confirm: { readonly label: string; readonly input: NightConfirmation } | null;
  readonly message: string;
}

export function describeNightSeatSelection(
  model: NightInteractionModel,
  seats: readonly number[],
): NightSeatSelection | null {
  const action = nightSeatAction(model);
  if (action === null) return null;
  const selected = seats.filter((seat) => action.eligible.includes(seat));
  const eligible = action.eligible.filter(
    (seat) => selected.length < action.max || action.max === 1 || selected.includes(seat),
  );
  const targetText = selected.map(formatSeat).join('、');
  const confirm =
    selected.length < action.min
      ? null
      : {
          label: `${action.verb} ${targetText}`,
          input:
            model.kind === 'witch'
              ? ({ kind: 'poison', seat: selected[0]! } as const)
              : model.kind === 'multiSelect' || model.kind === 'pickTwoSeats'
                ? ({ kind: 'seats', seats: selected } as const)
                : ({ kind: 'seat', seat: selected[0]! } as const),
        };
  const immune =
    model.kind === 'wolfVote' && selected.some((seat) => model.immuneSeats.includes(seat));
  const progress = action.max === 1 ? action.label : `已选 ${selected.length} / ${action.max} 人`;
  return {
    eligible,
    seats: selected,
    confirm,
    message: immune ? `${progress} · 该角色免疫狼人袭击` : progress,
  };
}
