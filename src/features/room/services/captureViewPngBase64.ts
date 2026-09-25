/** Capture a React Native view as raw PNG base64 across Web and native runtimes. */

import type { RefObject } from 'react';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { loadHtml2canvas } from './loadHtml2canvas';

const BASE64_MARKER = 'base64,';

function parseBase64DataUrl(dataUrl: string): string {
  const markerIndex = dataUrl.indexOf(BASE64_MARKER);
  if (markerIndex < 0) {
    throw new Error('[FAIL-FAST] Captured view must be a base64 data URL');
  }
  return dataUrl.slice(markerIndex + BASE64_MARKER.length);
}

/**
 * Capture a mounted view, keeping its images and the surrounding layout/styles.
 * @remarks Excludes unrelated images before cloning: iframe load waits for them without a timeout.
 */
export async function captureViewPngBase64(ref: RefObject<unknown>): Promise<string> {
  if (ref.current === null) {
    throw new Error('[FAIL-FAST] Capture view ref is not mounted');
  }

  if (Platform.OS === 'web') {
    if (typeof HTMLElement === 'undefined' || !(ref.current instanceof HTMLElement)) {
      throw new Error('[FAIL-FAST] Capture view ref must resolve to an HTMLElement on Web');
    }

    const element = ref.current;
    const html2canvas = await loadHtml2canvas();
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      ignoreElements: (node) => node.tagName === 'IMG' && !element.contains(node),
    });
    return parseBase64DataUrl(canvas.toDataURL('image/png'));
  }

  return captureRef(ref, { format: 'png', result: 'base64', quality: 1 });
}
