import type { ReactNode } from 'react';

import { RoomDialog } from './RoomDialog';

export type RoomInformation = 'guide' | 'configuration' | null;

/** Displays the room's guide or configuration using the shared dialog behavior. */
export function RoomInformationDialog({
  information,
  guideTitle,
  guide,
  configuration,
  onClose,
}: {
  readonly information: RoomInformation;
  readonly guideTitle: string;
  readonly guide: ReactNode;
  readonly configuration: ReactNode;
  readonly onClose: () => void;
}) {
  if (information === null) return null;
  const isGuide = information === 'guide';
  return (
    <RoomDialog
      title={isGuide ? guideTitle : '本局配置'}
      onClose={onClose}
      dismissOnEscape
      footer={null}
    >
      {isGuide ? guide : configuration}
    </RoomDialog>
  );
}
