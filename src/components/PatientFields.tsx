import type { PatientFormErrors, PatientFormValues } from '../types/Patient'
import { frequentCountryCodes } from '../utils/patientForm'

interface PatientFieldsProps {
  disabled?: boolean
  errors: PatientFormErrors
  idPrefix: string
  values: PatientFormValues
  onChange: (field: keyof PatientFormValues, value: string) => void
}

export function PatientFields({
  disabled = false,
  errors,
  idPrefix,
  values,
  onChange,
}: PatientFieldsProps) {
  const usesFrequentCountryCode = frequentCountryCodes.some(
    (option) => option.code === values.countryCode,
  )
  return (
    <>
      <label>
        <span>Nombre</span>
        <input
          aria-describedby={
            errors.firstName ? `${idPrefix}-first-name-error` : undefined
          }
          aria-invalid={Boolean(errors.firstName)}
          autoComplete="given-name"
          disabled={disabled}
          id={`${idPrefix}-first-name`}
          placeholder="Ej. Charles"
          type="text"
          value={values.firstName}
          onChange={(event) => onChange('firstName', event.target.value)}
        />
        {errors.firstName && (
          <small id={`${idPrefix}-first-name-error`}>{errors.firstName}</small>
        )}
      </label>

      <label>
        <span>Apellido</span>
        <input
          aria-describedby={
            errors.lastName ? `${idPrefix}-last-name-error` : undefined
          }
          aria-invalid={Boolean(errors.lastName)}
          autoComplete="family-name"
          disabled={disabled}
          placeholder="Ej. Pérez"
          type="text"
          value={values.lastName}
          onChange={(event) => onChange('lastName', event.target.value)}
        />
        {errors.lastName && (
          <small id={`${idPrefix}-last-name-error`}>{errors.lastName}</small>
        )}
      </label>

      <fieldset className="phone-field">
        <legend>Teléfono</legend>
        <div className="phone-control">
          {usesFrequentCountryCode ? (
            <select
              aria-label="Prefijo de país"
              disabled={disabled}
              value={values.countryCode}
              onChange={(event) =>
                onChange(
                  'countryCode',
                  event.target.value === 'other' ? '+' : event.target.value,
                )
              }
            >
              {frequentCountryCodes.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} · {option.country}
                </option>
              ))}
              <option value="other">Otro</option>
            </select>
          ) : (
            <input
              aria-describedby={
                errors.countryCode
                  ? `${idPrefix}-country-code-error`
                  : undefined
              }
              aria-invalid={Boolean(errors.countryCode)}
              aria-label="Prefijo internacional"
              autoComplete="tel-country-code"
              className="country-code-manual-input"
              disabled={disabled}
              inputMode="tel"
              placeholder="+49"
              type="tel"
              value={values.countryCode}
              onChange={(event) => {
                const nextCountryCode = event.target.value

                onChange(
                  'countryCode',
                  nextCountryCode.trim() === '' ? '+591' : nextCountryCode,
                )
              }}
            />
          )}

          <input
            aria-describedby={
              errors.localPhone ? `${idPrefix}-phone-error` : undefined
            }
            aria-invalid={Boolean(errors.localPhone)}
            aria-label="Número local"
            autoComplete="tel-national"
            className="phone-number-input"
            disabled={disabled}
            inputMode="numeric"
            placeholder="70000000"
            type="tel"
            value={values.localPhone}
            onChange={(event) => onChange('localPhone', event.target.value)}
          />
        </div>

        {errors.countryCode && (
          <small id={`${idPrefix}-country-code-error`}>
            {errors.countryCode}
          </small>
        )}
        {errors.localPhone && (
          <small id={`${idPrefix}-phone-error`}>{errors.localPhone}</small>
        )}
      </fieldset>

      <label>
        <span>Email opcional</span>
        <input
          aria-describedby={
            errors.email ? `${idPrefix}-email-error` : undefined
          }
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          disabled={disabled}
          placeholder="correo@ejemplo.com"
          type="email"
          value={values.email}
          onChange={(event) => onChange('email', event.target.value)}
        />
        {errors.email && (
          <small id={`${idPrefix}-email-error`}>{errors.email}</small>
        )}
      </label>

      <label>
        <span>Fecha de nacimiento opcional</span>
        <input
          aria-describedby={
            errors.birthDate ? `${idPrefix}-birth-date-error` : undefined
          }
          aria-invalid={Boolean(errors.birthDate)}
          disabled={disabled}
          type="date"
          value={values.birthDate}
          onChange={(event) => onChange('birthDate', event.target.value)}
        />
        {errors.birthDate && (
          <small id={`${idPrefix}-birth-date-error`}>{errors.birthDate}</small>
        )}
      </label>
    </>
  )
}
