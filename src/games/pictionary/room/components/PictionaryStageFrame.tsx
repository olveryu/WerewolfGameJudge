/** Pictionary waiting-stage frame: shared stage skeleton with this game's pinned heading. */

import type React from 'react';

import { GalleryAlbumHeading } from '@/features/room/components/GalleryAlbumHeading';
import { StageFrame } from '@/features/room/components/StageFrame';
import { TESTIDS } from '@/testids';

interface PictionaryStageFrameProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly remainingSeconds: number | null;
  readonly children: React.ReactNode;
}

export const PictionaryStageFrame: React.FC<PictionaryStageFrameProps> = ({
  eyebrow,
  title,
  description,
  remainingSeconds,
  children,
}) => {
  return (
    <StageFrame
      testID={TESTIDS.pictionaryStageFrame}
      keyboardShouldPersistTaps="handled"
      header={
        <GalleryAlbumHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          remainingSeconds={remainingSeconds}
        />
      }
    >
      {children}
    </StageFrame>
  );
};
