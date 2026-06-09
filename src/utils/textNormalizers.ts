export function compactText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeSentenceText(value: string) {
  const compactValue = compactText(value)

  if (!compactValue) {
    return ''
  }

  const lowerText = compactValue.toLocaleLowerCase('es-BO')

  return `${lowerText.charAt(0).toLocaleUpperCase('es-BO')}${lowerText.slice(
    1,
  )}`
}
