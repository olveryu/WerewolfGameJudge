/** One collapsible public configuration card for every game's room. */
import './RoomGameSummary.css';

import { type ReactNode, useId, useState } from 'react';

import { TESTIDS } from '@/testids';
import IconBookOutline from '~icons/ion/book-outline';
import IconChevronDown from '~icons/ion/chevron-down';
import IconChevronUp from '~icons/ion/chevron-up';
import IconDocumentTextOutline from '~icons/ion/document-text-outline';

/** Games supply public content and intents, never another header or configuration frame. */
export function RoomGameSummary({
  title,
  playerCount,
  settings = [],
  status,
  guide,
  collapsed = false,
  onStrategyPress = null,
  onNotepadPress = null,
  children,
  testId,
}: {
  /** Game name only; the shared card formats the player count. */
  readonly title: string;
  readonly playerCount: number;
  /** Public settings only; introductions belong in the guide. */
  readonly settings?: readonly { readonly label: string; readonly value: string }[];
  /** Live status stays outside the collapsible card. */
  readonly status?: string;
  readonly guide: {
    readonly onPress: () => void;
    readonly label: string;
    readonly testId?: string;
  };
  /** Phase default; a manual choice overrides it for the rest of the visit. */
  readonly collapsed?: boolean;
  readonly onStrategyPress?: (() => void) | null;
  readonly onNotepadPress?: (() => void) | null;
  readonly children?: ReactNode;
  readonly testId?: string;
}) {
  const contentId = useId();
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
  const isCollapsed = userCollapsed ?? collapsed;
  const hasContent = settings.length > 0 || children != null;
  const toggle = () => setUserCollapsed(!isCollapsed);
  const gameTitle = `${title}（${playerCount}人）`;
  return (
    <>
      <section className="room-game-summary" data-testid={testId}>
        <div className="room-game-summary-row">
          <h2 className="room-game-summary-title" data-testid={TESTIDS.roomGameSummaryTitle}>
            {hasContent ? (
              <button
                type="button"
                className="room-game-summary-toggle"
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
                onClick={toggle}
              >
                {gameTitle}
              </button>
            ) : (
              gameTitle
            )}
          </h2>
          <div className="room-game-summary-actions">
            <RoomGameToolButton {...guide}>
              <IconBookOutline aria-hidden />
              玩法
            </RoomGameToolButton>
            {onStrategyPress !== null && (
              <RoomGameToolButton onPress={onStrategyPress} label="攻略">
                <IconBookOutline aria-hidden />
                攻略
              </RoomGameToolButton>
            )}
            {onNotepadPress !== null && (
              <RoomGameToolButton onPress={onNotepadPress} label="笔记">
                <IconDocumentTextOutline aria-hidden />
                笔记
              </RoomGameToolButton>
            )}
            {hasContent && (
              <button
                type="button"
                className="room-game-summary-chevron"
                aria-label={isCollapsed ? '展开配置' : '收起配置'}
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
                onClick={toggle}
              >
                {isCollapsed ? <IconChevronDown aria-hidden /> : <IconChevronUp aria-hidden />}
              </button>
            )}
          </div>
        </div>
        <div id={contentId} hidden={isCollapsed}>
          {!isCollapsed && hasContent && (
            <div className="room-game-summary-content">
              {children}
              {settings.length > 0 && (
                <dl className="room-game-summary-settings">
                  {settings.map(({ label, value }) => (
                    <div className="room-game-summary-setting" key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </section>
      {status !== undefined && (
        <p className="room-game-summary-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}

function RoomGameToolButton({
  onPress,
  label,
  testId,
  children,
}: {
  readonly onPress: () => void;
  /** Accessible name, e.g. 「查看阿瓦隆玩法」. */
  readonly label: string;
  readonly testId?: string;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="room-game-summary-tool"
      onClick={onPress}
      aria-label={label}
      data-testid={testId}
    >
      <span className="room-game-summary-tool-content">{children}</span>
    </button>
  );
}
