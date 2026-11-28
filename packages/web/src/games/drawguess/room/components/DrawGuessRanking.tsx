import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconClose from '~icons/ion/close';
import IconTrophyOutline from '~icons/ion/trophy-outline';

import { DrawGuessScoreboard, type DrawGuessScoreboardRow } from './DrawGuessScoreboard';

/** Opens the live cumulative ranking without pausing the round. */
export function DrawGuessRanking({ rows }: { readonly rows: readonly DrawGuessScoreboardRow[] }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="soft"
        size="md"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <IconTrophyOutline aria-hidden />
        总排名
        <IconChevronForward aria-hidden />
      </Button>
      {isOpen && (
        <BottomSheet title="本局总排名" onClose={() => setIsOpen(false)}>
          <header className="drawguess-ranking-header">
            <div>
              <h2>本局总排名</h2>
              <p>累计总分排名 · 同分并列</p>
            </div>
            <IconButton
              label="关闭总排名"
              icon={<IconClose aria-hidden />}
              onClick={() => setIsOpen(false)}
            />
          </header>
          <div className="drawguess-ranking-body">
            <DrawGuessScoreboard
              title="玩家积分"
              competitionRanking
              rows={rows.map((row) => ({ ...row, roundScore: null }))}
            />
          </div>
        </BottomSheet>
      )}
    </>
  );
}
