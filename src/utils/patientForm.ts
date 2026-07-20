import type { Patient, PatientFormValues } from '../types/Patient'
import { normalizePersonName } from './textNormalizers'

export const frequentCountryCodes = [
  { country: 'Bolivia', code: '+591' },
  { country: 'Argentina', code: '+54' },
  { country: 'Brasil', code: '+55' },
  { country: 'Chile', code: '+56' },
  { country: 'Perú', code: '+51' },
  { country: 'Paraguay', code: '+595' },
  { country: 'EE. UU. / Canadá', code: '+1' },
  { country: 'España', code: '+34' },
] as const

export function getPatientFormValues(patient: Patient): PatientFormValues {
  const fallbackNameParts = patient.fullName.trim().split(/\s+/)
  const firstName = patient.firstName ?? fallbackNameParts.shift() ?? ''
  const lastName = patient.lastName ?? fallbackNameParts.join(' ')
  const { countryCode, localPhone } = splitPatientPhone(patient)

  return {
    birthDate: patient.birthDate ?? '',
    countryCode,
    email: patient.email ?? '',
    firstName,
    lastName,
    localPhone,
  }
}

export function havePatientFormValuesChanged(
  patient: Patient,
  values: PatientFormValues,
) {
  return (
    JSON.stringify(getComparableValues(getPatientFormValues(patient))) !==
    JSON.stringify(getComparableValues(values))
  )
}

function getComparableValues(values: PatientFormValues) {
  return {
    birthDate: values.birthDate.trim(),
    countryCode: values.countryCode.trim(),
    email: values.email.trim().toLocaleLowerCase('es-BO'),
    firstName: normalizePersonName(values.firstName),
    lastName: normalizePersonName(values.lastName),
    localPhone: values.localPhone.replace(/\D/g, ''),
  }
}

function splitPatientPhone(patient: Patient) {
  const compactPhone = patient.phone.replace(/[\s()-]/g, '')
  const explicitCountryCode = patient.countryCode?.trim()

  if (explicitCountryCode && compactPhone.startsWith(explicitCountryCode)) {
    return {
      countryCode: explicitCountryCode,
      localPhone: compactPhone.slice(explicitCountryCode.length),
    }
  }

  const frequentCode = [...frequentCountryCodes]
    .sort((first, second) => second.code.length - first.code.length)
    .find((option) => compactPhone.startsWith(option.code))

  if (frequentCode) {
    return {
      countryCode: frequentCode.code,
      localPhone: compactPhone.slice(frequentCode.code.length),
    }
  }

  if (!compactPhone.startsWith('+')) {
    return { countryCode: '+591', localPhone: compactPhone.replace(/\D/g, '') }
  }

  const fallbackMatch = compactPhone.match(/^(\+\d{1,4})(\d{6,})$/)

  return fallbackMatch
    ? { countryCode: fallbackMatch[1], localPhone: fallbackMatch[2] }
    : { countryCode: '+591', localPhone: compactPhone.replace(/\D/g, '') }
}
