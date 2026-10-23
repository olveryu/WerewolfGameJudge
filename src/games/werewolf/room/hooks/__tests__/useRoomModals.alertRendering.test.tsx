/**
 * Renders the useRoomModals detail alert through the real showAlert listener
 * into a real AlertModal (mirrors the App.tsx host) and asserts the live
 * capture progress is readable as text on the share button — the config-level
 * assertions in useRoomModals.test.ts cannot catch a renderer that hides the
 * label behind a spinner.
 */

import { act, render } from '@testing-library/react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AlertModal } from '@/components/AlertModal';
import type { ReportCaptureProgress } from '@/games/werewolf/room/hooks/useNightReviewShare';
import { useRoomModals } from '@/games/werewolf/room/hooks/useRoomModals';
import { type AlertConfig, setAlertListener } from '@/utils/alert';

interface HarnessApi {
  openNightReview: () => void;
}

interface HarnessProps {
  progress: ReportCaptureProgress | null;
  apiRef: { current: HarnessApi | null };
}

/**
 * Stable deps for the harness. Inline object literals would give
 * useRoomModals new callback identities on every render, which re-fires its
 * progress effect in a loop; production passes useCallback-stable deps from
 * the room screen state, so the harness must do the same.
 */
const BASE_DEPS = {
  reportScopeKey: 'report-1',
  isHost: true,
  canShareReport: true,
  getLastNightInfo: () => '',
  getCurseInfo: () => null,
  shareNightReview: async () => {
    throw new Error('Unexpected night-review authorization call');
  },
  // Capture never settles: the alert stays in its loading/progress states.
  beginReportCapture: () => new Promise<string | null>(() => undefined),
  shareNightReviewReport: async () => {
    throw new Error('Unexpected night-review report share call');
  },
  isGameEnded: false,
  onLastNightInfoConfirmed: () => undefined,
};

/** Mirrors App.tsx: holds the current alert config and hosts one AlertModal. */
function AlertHarness({ progress, apiRef }: HarnessProps) {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);

  useEffect(() => {
    setAlertListener((config) => {
      setAlertConfig(config);
    });
    return () => setAlertListener(null);
  }, []);

  const deps = useMemo(() => ({ ...BASE_DEPS, reportCaptureProgress: progress }), [progress]);
  const modals = useRoomModals(deps);

  useEffect(() => {
    apiRef.current = { openNightReview: modals.openNightReview };
  });

  return alertConfig ? (
    <AlertModal
      visible={true}
      title={alertConfig.title}
      message={alertConfig.message}
      buttons={alertConfig.buttons}
      input={alertConfig.input}
      onClose={() => setAlertConfig(null)}
    />
  ) : null;
}

describe('useRoomModals detail alert rendering through AlertModal', () => {
  it('shows the share label, then live band progress text, while pre-capture runs', () => {
    const apiRef: { current: HarnessApi | null } = { current: null };
    const {
      getByText,
      queryByText,
      rerender,
      UNSAFE_getAllByType: getAllByType,
    } = render(<AlertHarness progress={null} apiRef={apiRef} />);

    act(() => apiRef.current?.openNightReview());

    // Pre-capture started, no band reported yet: plain label, spinner beside it.
    expect(getByText('分享战报')).toBeTruthy();
    expect(getAllByType(ActivityIndicator)).toHaveLength(1);

    rerender(<AlertHarness progress={{ done: 1, total: 3 }} apiRef={apiRef} />);

    expect(getByText('生成中 1/3 段')).toBeTruthy();
    expect(queryByText('分享战报')).toBeNull();
    expect(getAllByType(ActivityIndicator)).toHaveLength(1);

    rerender(<AlertHarness progress={{ done: 2, total: 3 }} apiRef={apiRef} />);

    expect(getByText('生成中 2/3 段')).toBeTruthy();
    expect(queryByText('生成中 1/3 段')).toBeNull();
  });
});
