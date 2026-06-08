import type {
  AppointmentFormErrors,
  AppointmentFormValues,
  AppointmentStatus,
} from '../types/Appointment'
import { treatments } from '../data/treatments'

export const appointmentInitialStatuses: AppointmentStatus[] = [
  'pending',
  'confirmed',
]

export function validateAppointmentForm(
  values: AppointmentFormValues,
  referenceDate = new Date(),
): AppointmentFormErrors {
  const errors: AppointmentFormErrors = {}

  if (!values.patient.trim()) {
    errors.patient = 'Selecciona un paciente.'
  }

  if (!values.date) {
    errors.date = 'Selecciona una fecha.'
  } else if (isPastDate(values.date, referenceDate)) {
    errors.date = 'La fecha no puede ser anterior a hoy.'
  }

  if (!values.time) {
    errors.time = 'Selecciona una hora.'
  }

  if (!values.treatment.trim()) {
    errors.treatment = 'Ingresa el motivo o tratamiento.'
  } else if (!treatments.includes(values.treatment)) {
    errors.treatment = 'Selecciona un tratamiento valido.'
  }

  if (!appointmentInitialStatuses.includes(values.status)) {
    errors.status = 'Selecciona un estado valido.'
  }

  return errors
}

export function hasAppointmentFormErrors(errors: AppointmentFormErrors) {
  return Object.values(errors).some(Boolean)
}

function isPastDate(date: string, referenceDate: Date) {
  const selectedDate = new Date(`${date}T00:00:00`)
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )

  return selectedDate.getTime() < today.getTime()
}
