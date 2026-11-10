/**
 * SimpleDashFrame — dashed
 *
 * Rounded dashed border. Common-tier avatar-frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

export const simpleDashFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  return `
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="${colors.primary}" stroke-width="1.5" stroke-dasharray="8 4" opacity="0.7"/>
  `;
};
