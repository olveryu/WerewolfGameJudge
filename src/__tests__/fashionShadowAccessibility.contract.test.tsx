import fs from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react-native';

import { FashionVoteProgress } from '@/games/fashion-shadow/components/FashionVoteProgress';

const FASHION_COMPONENTS_ROOT = path.resolve(__dirname, '../games/fashion-shadow/components');
const REANIMATED_MOTION_PATTERN = /\b(?:withTiming|withSequence|withRepeat|withSpring|FadeIn)\b/;
const REDUCED_MOTION_PATTERN = /\buseReducedMotion\b|ReduceMotion\.System|\.reduceMotion\(/;

function getFashionComponentFiles(): string[] {
  return fs
    .readdirSync(FASHION_COMPONENTS_ROOT)
    .filter((fileName) => fileName.endsWith('.tsx'))
    .map((fileName) => path.join(FASHION_COMPONENTS_ROOT, fileName));
}

describe('Fashion Shadow accessibility contracts', () => {
  it('marks vote submission count as an accessible progress value', () => {
    const { getByLabelText } = render(<FashionVoteProgress submitted={3} label="调查票提交进度" />);

    const progress = getByLabelText('调查票提交进度');
    expect(progress).toHaveProp('accessibilityRole', 'progressbar');
    expect(progress).toHaveProp('accessibilityValue', {
      min: 0,
      max: 7,
      now: 3,
      text: '3/7 人已提交',
    });
  });

  it('requires every custom Reanimated motion component to honor reduced-motion settings', () => {
    const offenders = getFashionComponentFiles()
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        return REANIMATED_MOTION_PATTERN.test(source) && !REDUCED_MOTION_PATTERN.test(source);
      })
      .map((filePath) => path.basename(filePath));

    expect(offenders).toEqual([]);
  });
});
