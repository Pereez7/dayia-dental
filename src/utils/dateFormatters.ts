export function formatCompactDateWithYear(date: string) {
  const formattedDate = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))

  return formattedDate.replace(/\s/g, '-')
}
