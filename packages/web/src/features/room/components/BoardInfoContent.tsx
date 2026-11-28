/** Public role composition inside the shared game configuration card. */
import './BoardInfoContent.css';

import type { ReactNode } from 'react';

import { FactionChip } from '@/components/FactionChip';
import type { BoardInfoSection } from '@/features/room/model/BoardInfoSection';

/** Renders configured role counts and reports previews without revealing dealt identities. */
export function BoardInfoContent({
  sections,
  onRolePress,
  footer,
}: {
  readonly sections: readonly BoardInfoSection[];
  /** Every role row opens a preview: a role the player cannot inspect is a bug. */
  readonly onRolePress: (roleId: string) => void;
  /** Game-specific actions under the roles (e.g. werewolf board nominations). */
  readonly footer: ReactNode;
}) {
  return (
    <div className="board-info-content">
      {sections.map(
        (section) =>
          section.items.length > 0 && (
            <div key={section.title} className="board-info-category">
              <span className="board-info-category-label">{section.title}：</span>
              <div className="board-info-chips">
                {section.items.map((item) => (
                  <FactionChip
                    key={item.roleId}
                    label={item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
                    tone={section.tone}
                    size="md"
                    onPress={() => onRolePress(item.roleId)}
                    showChevron
                  />
                ))}
              </div>
            </div>
          ),
      )}
      {footer !== null && footer !== false && <div className="board-info-footer">{footer}</div>}
    </div>
  );
}
