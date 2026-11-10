import './AdminComponents.css';

import IconChevronBack from '~icons/ion/chevron-back';
import IconChevronForward from '~icons/ion/chevron-forward';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Previous / next page control for admin lists; hidden when there is only one page. */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="admin-pagination" aria-label="分页">
      <button
        type="button"
        className="admin-page-button"
        aria-label="上一页"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <IconChevronBack aria-hidden />
      </button>
      <span className="admin-page-info">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        className="admin-page-button"
        aria-label="下一页"
        disabled={page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        <IconChevronForward aria-hidden />
      </button>
    </nav>
  );
}
