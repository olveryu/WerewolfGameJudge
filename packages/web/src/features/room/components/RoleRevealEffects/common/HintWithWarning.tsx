import type { CSSProperties } from 'react';

import IonHourglassOutline from '~icons/ion/hourglass-outline';

const WARNING_COLOR = 'rgba(255, 200, 50, 0.9)';
const HINT_COLOR = 'rgba(255, 255, 255, 0.85)';
const TEXT_SHADOW = '0 1px 4px rgba(0, 0, 0, 0.6)';

const CONTAINER_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 80,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  zIndex: 10,
  pointerEvents: 'none',
};

const HINT_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
  color: HINT_COLOR,
  textAlign: 'center',
  textShadow: TEXT_SHADOW,
};

const WARNING_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
  color: WARNING_COLOR,
  textAlign: 'center',
  textShadow: TEXT_SHADOW,
};

interface HintWithWarningProps {
  readonly hintText: string | null;
  readonly showWarning: boolean;
  readonly hintStyle?: CSSProperties;
}

/** The interaction hint under an effect, replaced by the auto-reveal warning near the timeout. */
export function HintWithWarning({ hintText, showWarning, hintStyle }: HintWithWarningProps) {
  if (showWarning) {
    return (
      <div style={CONTAINER_STYLE}>
        <p style={WARNING_STYLE}>
          <IonHourglassOutline width={18} height={18} style={{ verticalAlign: 'text-bottom' }} />{' '}
          即将自动揭晓…
        </p>
      </div>
    );
  }
  if (!hintText) return null;
  return (
    <div style={CONTAINER_STYLE}>
      <p style={{ ...HINT_STYLE, ...hintStyle }}>{hintText}</p>
    </div>
  );
}
