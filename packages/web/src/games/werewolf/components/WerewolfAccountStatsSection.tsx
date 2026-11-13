/** Werewolf statistics extension rendered on the account settings screen. */
import { WerewolfProfileDetails } from './WerewolfProfileDetails';

/** Camp distribution of the signed-in user's werewolf games. */
export function WerewolfAccountStatsSection({ userId }: { readonly userId: string }) {
  return <WerewolfProfileDetails userId={userId} />;
}
