import './AccountAvatar.css';

import IconPersonCircleOutline from '~icons/ion/person-circle-outline';

import { formatTicketBadgeCount } from '../ticketBadgeCount';
import { Avatar } from './Avatar';

/** Side of the account entry's avatar in px (Home and room headers). */
const ACCOUNT_AVATAR_SIZE = 36;

/**
 * Class of the element that carries an account entry (a link on Home, a button in a room): a
 * bare touch target around {@link AccountAvatar}, with no surface of its own.
 */
export const ACCOUNT_ENTRY_CLASS = 'account-entry';

interface AccountAvatarProps {
  /** The signed-in user; null shows a person glyph. */
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
}

/** The signed-in user's avatar, or a person glyph: the face of every account entry. */
export function AccountAvatar({ user }: AccountAvatarProps) {
  if (user === null) return <IconPersonCircleOutline className="account-placeholder" aria-hidden />;
  return <Avatar userId={user.id} avatarUrl={user.avatarUrl ?? null} size={ACCOUNT_AVATAR_SIZE} />;
}

/** The gacha ticket count over an account entry; nothing while there are no tickets. */
export function AccountTicketBadge({ count }: { readonly count: number }) {
  if (count <= 0) return null;
  return (
    <span className="account-ticket-badge" aria-label={`${count} 张抽奖券`} role="img">
      {formatTicketBadgeCount(count)}
    </span>
  );
}
