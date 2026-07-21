export function formatCompactDateWithYear(date: string) {
  const formattedDate = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))

  return formattedDate.replace(/\s/g, '-')
}

export function formatOptionalCompactDateWithYear(
  date: string | null | undefined,
  fallback = 'Sin registro',
) {
  if (!date || !isDateInputValue(date)) {
    return fallback
  }

  return formatCompactDateWithYear(date)
}

export function formatAppDate(
  date: string,
  referenceDate = new Date(),
) {
  if (!isValidDateValue(date)) {
    return 'Fecha no disponible'
  }

  const parsedDate = new Date(date.includes('T') ? date : `${date}T00:00:00`)
  const includeYear = parsedDate.getFullYear() !== referenceDate.getFullYear()
  const hasTime = date.includes('T')

  const dateLabel = formatShortDate(parsedDate, includeYear)

  if (!hasTime) {
    return dateLabel
  }

  const timeLabel = new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
  }).format(parsedDate)

  return `${dateLabel}, ${timeLabel}`
}

export function formatClinicalHistoryDate(
  date: string,
  referenceDate = new Date(),
) {
  return formatAppDate(date, referenceDate)
}

export function formatSubscriptionDate(
  value: string | null | undefined,
  fallback = 'No definido',
) {
  if (!value) return fallback
  return formatAppDate(value.slice(0, 10))
}

function isDateInputValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function isValidDateValue(value: string) {
  if (!value) {
    return false
  }

  return !Number.isNaN(
    new Date(value.includes('T') ? value : `${value}T00:00:00`).getTime(),
  )
}

function formatShortDate(date: Date, includeYear: boolean) {
  const formattedDate = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(date)

  return formattedDate.replace(/\./g, '').replace(/-/g, ' ').replace(/\s+/g, ' ')
}
