/**
 * EncyclopediaShell — shared segmented encyclopedia page: header with the active segment's
 * actions, the segment tabs, and the active segment's content. Segment contents and header
 * actions come from the game binding; the "roles" segment machinery (state hook, content,
 * header actions) is shared too and assembled by the binding.
 */
import './Encyclopedia.css';

import { Tabs } from '@ark-ui/react/tabs';
import { type ReactNode, useState } from 'react';

import { handleHorizontalTabKeyDown } from '@/components/horizontalTabKeyboardNavigation';
import { ScreenHeader } from '@/components/ScreenHeader';

export interface EncyclopediaSegment {
  readonly key: string;
  readonly label: string;
}

interface EncyclopediaShellProps {
  /** Header title (e.g. 「狼人杀玩法」). */
  readonly title: string;
  readonly testId?: string;
  /** Where Back goes when the page was opened directly. */
  readonly parentPath: string;
  /** Segments in order. */
  readonly segments: readonly EncyclopediaSegment[];
  readonly initialTab: string;
  /** Renders one segment's content by key. */
  readonly renderSegment: (segmentKey: string) => ReactNode;
  /** Header actions per segment key; a segment without an entry has none. */
  readonly segmentHeaderActions?: Readonly<Record<string, ReactNode>>;
}

/** Segmented encyclopedia page. */
export function EncyclopediaShell({
  title,
  testId,
  parentPath,
  segments,
  initialTab,
  renderSegment,
  segmentHeaderActions,
}: EncyclopediaShellProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="encyclopedia-page" data-testid={testId}>
      <ScreenHeader title={title} parentPath={parentPath}>
        <div className="encyclopedia-header-actions">{segmentHeaderActions?.[activeTab]}</div>
      </ScreenHeader>
      <Tabs.Root
        className="encyclopedia-tabs"
        value={activeTab}
        onValueChange={(details) => setActiveTab(details.value)}
      >
        <Tabs.List
          className="encyclopedia-segments"
          aria-label={title}
          onKeyDown={handleHorizontalTabKeyDown}
        >
          {segments.map((segment) => (
            <Tabs.Trigger key={segment.key} value={segment.key} className="encyclopedia-segment">
              {segment.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value={activeTab} className="encyclopedia-content">
          {renderSegment(activeTab)}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
