import type { Appointment } from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import { canRescheduleAppointment } from './appointmentActions'
import {
  hasAppointmentConflict,
  hasPatientAppointmentOnDate,
  isPastTimeForDate,
} from './appointmentConflicts'
import type {
  AppointmentReasonPayload,
  AppointmentRescheduleReason,
} from './appointmentReasons'
import {
  appendAppointmentLogEntry,
  createAppointmentRescheduledLog,
} from './appointmentChangeLog'
import { validateAppointmentAgainstBusinessHours } from './businessHours'

export interface AppointmentRescheduleValues {
  date: string
  reason: AppointmentRescheduleReason | ''
  reasonDetail: string
  time: string
}

export type AppointmentRescheduleErrors = Partial<
  Record<keyof AppointmentRescheduleValues | 'appointment' | 'patient', string>
>

export function rescheduleAppointment(
  appointment: Appointment,
  values: AppointmentRescheduleValues,
  reasonPayload?: AppointmentReasonPayload,
): Appointment {
  const updatedAppointment: Appointment = {
    ...appointment,
    date: values.date,
    rescheduleReason: reasonPayload?.reason,
    rescheduleReasonDetail: reasonPayload?.reasonDetail,
    status: 'rescheduled',
    time: values.time,
  }

  return appendAppointmentLogEntry(
    updatedAppointment,
    createAppointmentRescheduledLog(
      appointment,
      {
        date: values.date,
        time: values.time,
      },
      reasonPayload,
    ),
  )
}

export function validateAppointmentReschedule(
  appointment: Appointment,
  values: AppointmentRescheduleValues,
  appointments: Appointment[],
  businessHours: BusinessHoursSettings,
  referenceDate = new Date(),
) {
  const errors: AppointmentRescheduleErrors = {}

  if (!canRescheduleAppointment(appointment.status)) {
    errors.appointment = 'No puedes reprogramar una cita cancelada.'
  }

  if (
    !errors.appointment &&
    values.date === appointment.date &&
    values.time === appointment.time
  ) {
    errors.appointment =
      'Debes cambiar la fecha o la hora para reprogramar la cita.'
  }

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
