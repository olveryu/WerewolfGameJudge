/**
 * ChooseBottomCardModal — bottom card selection (Treasure Master / Thief).
 *
 * Pure display over the engine's `BottomCardChoice`: each card carries its own selectability
 * and rejection reason. Pressing a selectable card asks for confirmation; on confirm it reports
 * `onChoose(cardIndex)`. Mounted means open.
 */
import '@/components/CenterDialog.css';
import './ChooseBottomCardModal.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import {
  type BottomCardChoice,
  getRoleDisplayName,
} from '@game-judge/game-engine/games/werewolf/public';

import { Button } from '@/components/Button';
import { getRoleBadge } from '@/games/werewolf/assets/roleBadges';
import { TESTIDS } from '@/testids';
import { showConfirmAlert } from '@/utils/alertPresets';

export function ChooseBottomCardModal({
  choice,
  confirmText,
  onChoose,
  onClose,
}: {
  readonly choice: BottomCardChoice;
  readonly confirmText: string;
  readonly onChoose: (cardIndex: number) => void | Promise<void>;
  readonly onClose: () => void;
}) {
  const handleCardPress = (cardIndex: number, displayName: string) => {
    showConfirmAlert('确认选择', `${confirmText}\n\n${displayName}`, () => onChoose(cardIndex));
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="center-dialog-positioner">
          <Dialog.Content
            className="center-dialog choose-card-dialog"
            data-testid={TESTIDS.chooseBottomCardModal}
          >
            <Dialog.Title className="center-dialog-title">选择底牌</Dialog.Title>
            <Dialog.Description className="center-dialog-subtitle">
              {choice.hint}
            </Dialog.Description>
            <div className="choose-card-list">
              {choice.cards.map((card, index) => {
                const displayName = getRoleDisplayName(card.roleId);
                return (
                  <button
                    key={`${card.roleId}-${index}`}
                    type="button"
                    className="choose-card-option"
                    disabled={!card.isSelectable}
                    data-testid={TESTIDS.chooseBottomCardOption(index)}
                    onClick={() => handleCardPress(index, displayName)}
                  >
                    <img className="choose-card-badge" src={getRoleBadge(card.roleId)} alt="" />
                    <span className="choose-card-info">
                      <span className="choose-card-name">{displayName}</span>
                      {card.reason !== null && (
                        <span className="choose-card-hint">{card.reason}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
