const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validatePlatformOwnerEmailCorrection(
  value: string,
  currentEmail: string | null,
) {
  const email = value.trim().toLowerCase()

  if (!email || !emailPattern.test(email)) {
    return 'Ingresa un email válido.'
  }

  if (email === currentEmail?.trim().toLowerCase()) {
    return 'Ingresa un correo diferente al actual.'
  }

  return ''
}
