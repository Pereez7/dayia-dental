import type { Appointment } from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import {
  hasAppointmentConflict,
  hasPatientAppointmentOnDate,
  isPastTimeForDate,
} from './appointmentConflicts'
import { validateAppointmentAgainstBusinessHours } from './businessHours'

export interface AppointmentRescheduleValues {
  date: string
  time: string
}

export type AppointmentRescheduleErrors = Partial<
  Record<keyof AppointmentRescheduleValues | 'patient', string>
>

export function rescheduleAppointment(
  appointment: Appointment,
  values: AppointmentRescheduleValues,
): Appointment {
  return {
    ...appointment,
    date: values.date,
    status: 'rescheduled',
    time: values.time,
  }
}

export function validateAppointmentReschedule(
  appointment: Appointment,
  values: AppointmentRescheduleValues,
  appointments: Appointment[],
  businessHours: BusinessHoursSettings,
  referenceDate = new Date(),
) {
  const errors: AppointmentRescheduleErrors = {}

  if (!values.date) {
    errors.date = 'Selecciona una fecha.'
  } else if (isPastDate(values.date, referenceDate)) {
    errors.date = 'La fecha no puede ser anterior a hoy.'
  }

  const businessHoursError =
    values.date && !errors.date
      ? validateAppointmentAgainstBusinessHours(
          businessHours,
          values.date,
          values.time,
        )
      : ''

  if (businessHoursError === 'El consultorio está cerrado ese día.') {
    errors.date = businessHoursError
  } else if (!values.time) {
    errors.time = 'Selecciona una hora.'
  } else if (businessHoursError) {
    errors.time = businessHoursError
  } else if (isPastTimeForDate(values.date, values.time, referenceDate)) {
    errors.time = 'No puedes seleccionar una hora que ya pasó.'
  } else if (
    hasAppointmentConflict(
      appointments,
      values.date,
      values.time,
      appointment.id,
    )
  ) {
    errors.time = 'Ya existe una cita programada para esa fecha y hora.'
  }

  if (
    appointment.patientId !== undefined &&
    values.date &&
    !errors.date &&
    hasPatientAppointmentOnDate(
      appointments,
      appointment.patientId,
      values.date,
      appointment.id,
    )
  ) {
    errors.patient = 'Este paciente ya tiene otra cita activa ese día.'
  }

  return errors
}

export function hasAppointmentRescheduleErrors(
  errors: AppointmentRescheduleErrors,
) {
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
