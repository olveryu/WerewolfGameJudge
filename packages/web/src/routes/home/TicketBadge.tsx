import { AccountTicketBadge } from '@/components/avatar/AccountAvatar';
import { countUnusedTickets } from '@/features/gacha/model/unusedTickets';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';

/** Gacha ticket count over the Home account avatar; hidden until tickets are available. */
export function TicketBadge() {
  const { data: gachaStatus } = useGachaStatusQuery();
  if (!gachaStatus) return null;
  return <AccountTicketBadge count={countUnusedTickets(gachaStatus)} />;
}
