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

function isDateInputValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}
