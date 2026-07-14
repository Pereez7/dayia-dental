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

export function normalizeSearchText(value: string) {
  return compactText(value)
    .toLocaleLowerCase('es-BO')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

const lowercaseNameParticles = new Set([
  'da',
  'das',
  'de',
  'del',
  'do',
  'dos',
  'la',
  'las',
  'los',
  'y',
])

export function normalizePersonName(value: string) {
  const words = compactText(value)
    .toLocaleLowerCase('es-BO')
    .split(' ')

  return words
    .map((word, index) => {
      if (index > 0 && lowercaseNameParticles.has(word)) {
        return word
      }

      return word
        .split(/([-'])/)
        .map((part) =>
          part === '-' || part === "'"
            ? part
            : `${part.charAt(0).toLocaleUpperCase('es-BO')}${part.slice(1)}`,
        )
        .join('')
    })
    .join(' ')
}
