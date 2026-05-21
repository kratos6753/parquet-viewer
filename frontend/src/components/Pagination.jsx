export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const delta = 2

  const range = (start, end) => {
    const r = []
    for (let i = start; i <= end; i++) r.push(i)
    return r
  }

  const left = Math.max(2, currentPage - delta)
  const right = Math.min(totalPages - 1, currentPage + delta)

  pages.push(1)
  if (left > 2) pages.push('...')
  pages.push(...range(left, right))
  if (right < totalPages - 1) pages.push('...')
  if (totalPages > 1) pages.push(totalPages)

  const btnBase = 'min-w-[2rem] h-8 px-2 rounded text-sm font-medium transition-colors'
  const active = 'bg-blue-600 text-white'
  const inactive = 'text-gray-600 hover:bg-gray-100'
  const disabled = 'text-gray-300 cursor-not-allowed'

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btnBase} ${currentPage === 1 ? disabled : inactive}`}
        aria-label="Previous page"
      >
        ‹
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="min-w-[2rem] h-8 flex items-center justify-center text-gray-400 text-sm">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`${btnBase} ${p === currentPage ? active : inactive}`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btnBase} ${currentPage === totalPages ? disabled : inactive}`}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  )
}
