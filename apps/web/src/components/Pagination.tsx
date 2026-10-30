import ui from "./ui.module.css";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      className={[ui.row, className].filter(Boolean).join(" ")}
      aria-label="Pagination"
      data-testid="pagination"
    >
      <button
        type="button"
        className={[ui.button, ui.buttonSecondary].join(" ")}
        disabled={!canPrev}
        aria-disabled={!canPrev}
        onClick={() => canPrev && onPageChange(page - 1)}
      >
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className={[ui.button, ui.buttonSecondary].join(" ")}
        disabled={!canNext}
        aria-disabled={!canNext}
        onClick={() => canNext && onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
