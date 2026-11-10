/**
 * One review page. The in-room dialog and the exported image render this
 * same view, so the two cannot drift; `export` mode adds only the image
 * chrome — the share title, the page position of a multi-page document
 * and rounded corners. The dialog already titles the screen, so only the
 * export receives a share title.
 */
import './review.css';

import type { RoomReviewDocument } from '../types';
import { ReviewTag } from './ReviewAtoms';
import { ReviewBlockView } from './ReviewBlockView';

export type ReviewDocumentViewProps = {
  readonly document: RoomReviewDocument;
  readonly pageIndex: number;
} & (
  | { readonly mode: 'screen' }
  | {
      readonly mode: 'export';
      /** `formatReviewShareTitle` of the room, printed in the image masthead. */
      readonly shareTitle: string;
    }
);

export function ReviewDocumentView(props: ReviewDocumentViewProps) {
  const { document, pageIndex } = props;
  const page = document.pages[pageIndex];
  if (page === undefined) {
    throw new Error(`[FAIL-FAST] Review ${document.fileStem} has no page ${pageIndex}`);
  }
  const isExport = props.mode === 'export';
  return (
    <article className="review-page" data-mode={props.mode}>
      <div className="review-chrome">
        <div className="review-accent-bar" />
        <div className="review-masthead">
          <div className="review-masthead-lead">
            <p className="review-kicker">{document.kicker}</p>
            {document.isAborted && <ReviewTag text="未完成" tone="out" />}
          </div>
          {props.mode === 'export' && <p className="review-masthead-title">{props.shareTitle}</p>}
        </div>
        {isExport && page.label !== null && (
          <p className="review-page-label">
            {`${page.label} · ${pageIndex + 1}/${document.pages.length}`}
          </p>
        )}
      </div>
      <div className="review-body">
        {page.blocks.map((block, index) => (
          <ReviewBlockView key={index} block={block} blockId={`${page.key}/${index}`} />
        ))}
        <p className="review-footer">{document.footer}</p>
      </div>
    </article>
  );
}
