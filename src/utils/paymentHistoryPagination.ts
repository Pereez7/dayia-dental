export const PAYMENT_HISTORY_PAGE_SIZE = 5

export type PaymentHistoryPaginationItem =
  | number
  | 'ellipsis-end'
  | 'ellipsis-start'

export function paginatePaymentHistory<T>(
  items: T[],
  requestedPage: number,
  pageSize = PAYMENT_HISTORY_PAGE_SIZE,
) {
  const safePageSize = Math.max(1, Math.trunc(pageSize))
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize))
  const currentPage = Math.min(
    Math.max(1, Math.trunc(requestedPage) || 1),
    pageCount,
  )
  const startIndex = (currentPage - 1) * safePageSize
  const endIndex = Math.min(startIndex + safePageSize, items.length)

  return {
    currentPage,
    endIndex,
    items: items.slice(startIndex, endIndex),
    pageCount,
    startIndex,
    totalItems: items.length,
  }
}

export function getPaymentHistoryPaginationItems(
  currentPage: number,
  pageCount: number,
): PaymentHistoryPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', pageCount]
  }

  if (currentPage >= pageCount - 3) {
    return [
      1,
      'ellipsis-start',
      pageCount - 4,
      pageCount - 3,
      pageCount - 2,
      pageCount - 1,
      pageCount,
    ]
  }

  return [
    1,
    'ellipsis-start',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis-end',
    pageCount,
  ]
}
