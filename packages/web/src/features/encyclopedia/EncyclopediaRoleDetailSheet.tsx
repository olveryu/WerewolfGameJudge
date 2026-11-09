/**
 * Encyclopedia role detail bottom sheet: hero (detail image, name, subtitle, faction chip),
 * ability tag chips and the structured description shared with the role card. A game-owned hero
 * action (the werewolf AI 攻略 pill) comes in through `headerExtra`.
 */
import './Encyclopedia.css';

import type { ReactNode } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { DescriptionFields } from '@/features/room/components/RoleCard';

import type { EncyclopediaRoleEntry } from './encyclopediaSource';

/** Renders a game-owned action in the detail hero. */
export type EncyclopediaRoleDetailExtra = (
  entry: EncyclopediaRoleEntry,
  onClose: () => void,
) => ReactNode;

/** Mounted means open. */
export function EncyclopediaRoleDetailSheet({
  entry,
  onClose,
  headerExtra,
}: {
  readonly entry: EncyclopediaRoleEntry;
  readonly onClose: () => void;
  readonly headerExtra?: EncyclopediaRoleDetailExtra;
}) {
  const tags = entry.tags ?? [];
  return (
    <BottomSheet title={entry.displayName} onClose={onClose}>
      <div className="encyclopedia-detail" data-color-key={entry.factionColorKey}>
        <div className="encyclopedia-detail-hero">
          {entry.detailImage !== undefined && (
            <img className="encyclopedia-detail-image" src={entry.detailImage} alt="" />
          )}
          <div className="encyclopedia-detail-info">
            <h2 className="encyclopedia-detail-name">{entry.displayName}</h2>
            {entry.subtitle !== undefined && entry.subtitle.length > 0 && (
              <p className="encyclopedia-detail-subtitle">{entry.subtitle}</p>
            )}
            <span className="encyclopedia-detail-faction">{entry.factionLabel}</span>
          </div>
          {headerExtra?.(entry, onClose)}
        </div>

        {tags.length > 0 && (
          <div className="encyclopedia-detail-tags">
            {tags.map((tag) => (
              <span key={tag.key} className="encyclopedia-detail-tag" data-color-key={tag.colorKey}>
                {tag.label}
              </span>
            ))}
          </div>
        )}

        <div className="encyclopedia-detail-description">
          {entry.structuredFields.length > 0 ? (
            <DescriptionFields fields={entry.structuredFields} />
          ) : (
            <p className="encyclopedia-detail-text">{entry.description}</p>
          )}
        </div>

        <Button className="encyclopedia-detail-confirm" onClick={onClose}>
          知道了
        </Button>
      </div>
    </BottomSheet>
  );
}
