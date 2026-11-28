/**
 * EncyclopediaShell — shared segmented encyclopedia page: header with the active segment's
 * actions, the segment tabs, and the active segment's content. Segment contents and header
 * actions come from the game binding; the "roles" segment machinery (state hook, content,
 * header actions) is shared too and assembled by the binding.
 */
import './Encyclopedia.css';

import { type ReactNode, useState } from 'react';

import { ScreenHeader } from '@/components/ScreenHeader';
import { TabList, TabPanel, Tabs } from '@/components/Tabs';

export interface EncyclopediaSegment {
  readonly key: string;
  readonly label: string;
}

interface EncyclopediaShellProps {
  /** Header title (e.g. 「狼人杀玩法」). */
  readonly title: string;
  readonly testId?: string;
  /** Where Back goes when the page was opened directly. */
  readonly parentPath: string | null;
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
    <div className={parentPath === null ? undefined : 'encyclopedia-page'} data-testid={testId}>
      {parentPath !== null && (
        <ScreenHeader title={title} parentPath={parentPath}>
          <div className="encyclopedia-header-actions">{segmentHeaderActions?.[activeTab]}</div>
        </ScreenHeader>
      )}
      <div className="encyclopedia-tabs">
        <Tabs value={activeTab} onValueChange={setActiveTab} fill>
          <div className="encyclopedia-segments">
            <TabList
              label={title}
              variant="segmented"
              items={segments.map((segment) => ({ value: segment.key, label: segment.label }))}
            />
          </div>
          {parentPath === null && segmentHeaderActions?.[activeTab] !== undefined && (
            <div className="encyclopedia-header-actions">{segmentHeaderActions[activeTab]}</div>
          )}
          <TabPanel value={activeTab} fill>
            {renderSegment(activeTab)}
          </TabPanel>
        </Tabs>
      </div>
    </div>
  );
}
