/**
 * BoardNominationModal — the room's board suggestions.
 *
 * Each card shows the board name, the submitter, the faction counts and, expanded, the per-faction
 * role chips (FactionRoleList), with upvote, withdraw (own suggestion) and adopt (host) actions.
 * Pressing a role chip opens its skill card. Mounted means open.
 */
import '@/components/CenterDialog.css';
import './BoardNominationList.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import {
  type BoardNomination,
  findMatchingPresetName,
  getPlayerCount,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';

import { IconButton } from '@/components/IconButton';
import { FactionRoleList } from '@/games/werewolf/components/FactionRoleList';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { computeFactionStats } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import IconCheckmarkCircleOutline from '~icons/ion/checkmark-circle-outline';
import IconChevronDown from '~icons/ion/chevron-down';
import IconChevronUp from '~icons/ion/chevron-up';
import IconClose from '~icons/ion/close';
import IconCloseCircleOutline from '~icons/ion/close-circle-outline';
import IconThumbsUp from '~icons/ion/thumbs-up';
import IconThumbsUpOutline from '~icons/ion/thumbs-up-outline';

function NominationCard({
  nomination,
  myUserId,
  isHost,
  expanded,
  onToggle,
  onRolePress,
  onUpvote,
  onWithdraw,
  onAdopt,
}: {
  readonly nomination: BoardNomination;
  readonly myUserId: string;
  readonly isHost: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onRolePress: (roleId: RoleId) => void;
  readonly onUpvote: (targetUserId: string) => void;
  readonly onWithdraw: () => void;
  readonly onAdopt: (roles: readonly RoleId[]) => void;
}) {
  const isMine = nomination.userId === myUserId;
  const hasUpvoted = nomination.upvoters.includes(myUserId);
  const roles = nomination.roles;
  const boardName = findMatchingPresetName(roles) ?? '自定义配置';
  const stats = computeFactionStats(roles);

  return (
    <article className="nomination-card">
      <button
        type="button"
        className="nomination-card-header"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="nomination-card-title">
          <span className="nomination-board-name">{boardName}</span>
          <span className="nomination-submitter">
            {nomination.displayName}
            {isMine && '（我）'}
          </span>
        </span>
        <span className="nomination-stats">
          <span className="nomination-player-badge">{getPlayerCount(roles)}人</span>
          <span className="nomination-stat-summary">
            狼{stats.wolfCount} 神{stats.godCount} 民{stats.villagerCount}
            {stats.thirdCount > 0 ? ` 特${stats.thirdCount}` : ''}
          </span>
          {expanded ? <IconChevronUp aria-hidden /> : <IconChevronDown aria-hidden />}
        </span>
      </button>

      {expanded && (
        <div className="nomination-roles">
          <FactionRoleList roles={roles} showStats={false} onRolePress={onRolePress} />
          <p className="nomination-role-hint">点击角色名查看能力说明</p>
        </div>
      )}

      <div className="nomination-actions">
        <button
          type="button"
          className="nomination-action"
          data-tone="primary"
          aria-pressed={hasUpvoted}
          onClick={() => onUpvote(nomination.userId)}
        >
          {hasUpvoted ? <IconThumbsUp aria-hidden /> : <IconThumbsUpOutline aria-hidden />}
          {nomination.upvoters.length > 0 ? `${nomination.upvoters.length}` : '点赞'}
        </button>
        {isMine && (
          <button
            type="button"
            className="nomination-action"
            data-tone="danger"
            onClick={onWithdraw}
          >
            <IconCloseCircleOutline aria-hidden />
            撤回
          </button>
        )}
        {isHost && (
          <button
            type="button"
            className="nomination-action"
            data-tone="primary"
            onClick={() => onAdopt(nomination.roles)}
          >
            <IconCheckmarkCircleOutline aria-hidden />
            采纳
          </button>
        )}
      </div>
    </article>
  );
}

export function BoardNominationModal({
  nominations,
  myUserId,
  isHost,
  onUpvote,
  onWithdraw,
  onAdopt,
  onClose,
}: {
  /** userId → BoardNomination record */
  readonly nominations: Readonly<Record<string, BoardNomination>>;
  readonly myUserId: string;
  readonly isHost: boolean;
  readonly onUpvote: (targetUserId: string) => void;
  readonly onWithdraw: () => void;
  /** Host adopts a nominated board (the caller clears seats first when the count changes). */
  readonly onAdopt: (roles: readonly RoleId[]) => Promise<void>;
  readonly onClose: () => void;
}) {
  const entries = Object.values(nominations).sort((a, b) => b.upvoters.length - a.upvoters.length);
  // Accordion: one card expanded at a time; the first entry by default.
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const activeUserId = expandedUserId ?? entries[0]?.userId ?? null;
  const toggleCard = (userId: string) =>
    setExpandedUserId((previous) =>
      previous === userId || (previous === null && userId === entries[0]?.userId) ? null : userId,
    );
  const [previewRoleId, setPreviewRoleId] = useState<RoleId | null>(null);

  const handleAdopt = async (roles: readonly RoleId[]) => {
    await onAdopt(roles);
    onClose();
  };

  return (
    <>
      <Dialog.Root
        open
        onOpenChange={(details) => {
          if (!details.open) onClose();
        }}
      >
        <Portal>
          <Dialog.Backdrop className="center-dialog-backdrop" />
          <Dialog.Positioner className="center-dialog-positioner">
            <Dialog.Content className="nomination-dialog">
              <header className="nomination-dialog-header">
                <Dialog.Title className="nomination-dialog-title">
                  板子建议（{entries.length}）
                </Dialog.Title>
                <IconButton label="关闭" icon={<IconClose aria-hidden />} onClick={onClose} />
              </header>
              <div className="nomination-dialog-body">
                {entries.length === 0 ? (
                  <p className="nomination-empty">还没有人提建议</p>
                ) : (
                  entries.map((nomination) => (
                    <NominationCard
                      key={nomination.userId}
                      nomination={nomination}
                      myUserId={myUserId}
                      isHost={isHost}
                      expanded={activeUserId === nomination.userId}
                      onToggle={() => toggleCard(nomination.userId)}
                      onRolePress={setPreviewRoleId}
                      onUpvote={onUpvote}
                      onWithdraw={onWithdraw}
                      onAdopt={(roles) => void handleAdopt(roles)}
                    />
                  ))
                )}
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <RoleCardSimple
        visible={previewRoleId !== null}
        roleId={previewRoleId}
        onClose={() => setPreviewRoleId(null)}
        showRealIdentity
      />
    </>
  );
}
