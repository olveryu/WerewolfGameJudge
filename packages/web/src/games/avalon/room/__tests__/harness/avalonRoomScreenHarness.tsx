/** Renders the real Avalon room screen inside the router and query providers it needs. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { MemoryRouter } from 'react-router';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';

import type { AvalonAudioRuntime } from '../../../audio/AvalonAudioPlayer';
import type { AvalonRoomSession } from '../../../model/AvalonRoomSession';
import { avalonReview } from '../../../review/avalonReview';
import { AvalonRoomScreen } from '../../AvalonRoomScreen';

/** Router plus a retry-free query client, as the app shell provides them. */
export function AvalonRoomTestProviders({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function createSilentAudio(): AvalonAudioRuntime {
  return {
    preload: vi.fn(),
    playEffect: vi.fn(async () => undefined),
    stopNarration: vi.fn(),
    startBgm: vi.fn(),
    stopBgm: vi.fn(),
    setBgmVolume: vi.fn(),
    setGameAudioVolume: vi.fn(),
  };
}

/** Phone layout width (jsdom reports 0, which the room layout rejects). */
const PHONE_VIEWPORT_WIDTH = 390;

/** The room screen element over a fake session with silent audio, on a phone-width viewport. */
export function avalonRoomScreenElement(room: RoomRecord<'avalon'>, session: AvalonRoomSession) {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: PHONE_VIEWPORT_WIDTH,
  });
  return (
    <AvalonRoomScreen
      room={room}
      entryReason={null}
      session={session}
      review={avalonReview}
      audio={createSilentAudio()}
    />
  );
}
