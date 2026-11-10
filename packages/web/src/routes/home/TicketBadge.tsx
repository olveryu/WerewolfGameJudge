import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';

const TICKET_BADGE_CAP = 99;

/** Gacha ticket count over the Home account avatar; hidden until tickets are available. */
export function TicketBadge() {
  const { data: gachaStatus } = useGachaStatusQuery();
  if (!gachaStatus) return null;
  const ticketCount = gachaStatus.normalDraws + gachaStatus.goldenDraws;
  if (ticketCount <= 0) return null;
  return (
    <span className="home-ticket-badge" aria-label={`${ticketCount} 张抽奖券`} role="img">
      {ticketCount > TICKET_BADGE_CAP ? `${TICKET_BADGE_CAP}+` : ticketCount}
    </span>
  );
}
