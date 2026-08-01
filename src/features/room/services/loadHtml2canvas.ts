/** Lazily load the Web-only view renderer without adding it to native startup. */

import type html2canvas from 'html2canvas';

export async function loadHtml2canvas(): Promise<typeof html2canvas> {
  return (await import('html2canvas')).default;
}
