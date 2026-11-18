import type {
  RoomBottomActionModel,
  RoomBottomButton,
  RoomBottomToolButton,
} from '@/features/room/model/RoomBottomActions';

export type RoomPanelPlayerAction = RoomBottomButton | RoomBottomToolButton;

export interface RoomBottomActionPresentation {
  readonly focusAction: RoomBottomButton | null;
  readonly additionalActions: readonly RoomPanelPlayerAction[];
  readonly hasMultiplePrimaryChoices: boolean;
}

export function resolveRoomBottomActionPresentation(
  model: RoomBottomActionModel,
): RoomBottomActionPresentation {
  if (model.kind === 'dock') {
    return {
      focusAction: model.primary,
      additionalActions: [model.leading, model.trailing].filter(
        (action): action is RoomBottomToolButton => action !== null,
      ),
      hasMultiplePrimaryChoices: false,
    };
  }

  const { primary, secondary, ghost } = model.layout;
  const hasMultiplePrimaryChoices = primary.length > 1;
  return {
    focusAction: primary.length === 1 ? (primary.at(0) ?? null) : null,
    additionalActions: [...(hasMultiplePrimaryChoices ? primary : []), ...secondary, ...ghost],
    hasMultiplePrimaryChoices,
  };
}
