/**
 * Shared reading components for game guides; the guide content stays game-owned. A guide opened
 * from a room (`/game/:gameType/guide/:roomCode`) goes back up to that room.
 */
import './GameGuide.css';

import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { IonIcon, type IoniconName } from '@/components/icons/IonIcon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TESTIDS } from '@/testids';
import IconInformationCircleOutline from '~icons/ion/information-circle-outline';

/** A readable guide page: kicker, heading, intro, then the game's sections. */
export function GameGuide({
  title,
  heading,
  intro,
  children,
  testId,
}: {
  readonly title: string;
  readonly heading: string;
  readonly intro: string;
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  const { roomCode } = useParams();
  return (
    <div className="game-guide-page" data-testid={testId}>
      <ScreenHeader
        title={title}
        parentPath={roomCode === undefined ? '/' : `/room/${parseRoomCode(roomCode)}`}
        backTestId={TESTIDS.gameGuideBackButton}
      />
      <main className="game-guide">
        <p className="game-guide-kicker">游戏目标</p>
        <h2 className="game-guide-heading" data-testid={TESTIDS.gameGuideHeading}>
          {heading}
        </h2>
        <p className="game-guide-intro">{intro}</p>
        {children}
      </main>
    </div>
  );
}

/** Groups related rules under a second-level heading. */
export function GameGuideSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="game-guide-section">
      <h2 className="game-guide-section-title">{title}</h2>
      {children}
    </section>
  );
}

/** One rule with a decorative icon and wrapping text. */
export function RuleItem({
  icon,
  title,
  description,
}: {
  readonly icon: IoniconName;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="game-guide-rule">
      <span className="game-guide-rule-icon" aria-hidden>
        <IonIcon name={icon} />
      </span>
      <div className="game-guide-rule-text">
        <p className="game-guide-rule-title">{title}</p>
        <p className="game-guide-rule-description">{description}</p>
      </div>
    </div>
  );
}

/** Highlights a public gameplay constraint without another card level. */
export function GameNotice({ text }: { readonly text: string }) {
  return (
    <p className="game-guide-notice">
      <IconInformationCircleOutline className="game-guide-notice-icon" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
