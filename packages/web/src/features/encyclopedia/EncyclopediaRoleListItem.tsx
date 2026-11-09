/** Encyclopedia role card: faction accent bar, list image, name and ability tag chips. */
import './Encyclopedia.css';

import { TESTIDS } from '@/testids';

import type { EncyclopediaRoleEntry } from './encyclopediaSource';

/** Role card button; opens the role detail. */
export function EncyclopediaRoleListItem({
  entry,
  onPress,
}: {
  readonly entry: EncyclopediaRoleEntry;
  readonly onPress: (roleId: string) => void;
}) {
  const tags = entry.tags ?? [];
  return (
    <button
      type="button"
      className="encyclopedia-role-card"
      data-color-key={entry.factionColorKey}
      data-testid={TESTIDS.encyclopediaRoleItem(entry.id)}
      onClick={() => onPress(entry.id)}
    >
      <span className="encyclopedia-role-accent" aria-hidden />
      {entry.listImage !== undefined && (
        <img className="encyclopedia-role-badge" src={entry.listImage} alt="" />
      )}
      <span className="encyclopedia-role-name">{entry.displayName}</span>
      {tags.length > 0 && (
        <span className="encyclopedia-tag-row">
          {tags.map((tag) => (
            <span key={tag.key} className="encyclopedia-tag" data-color-key={tag.colorKey}>
              {tag.label}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
