import type {
  Appointment,
  AppointmentFormErrors,
  AppointmentFormValues,
  AppointmentStatus,
} from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import type { Treatment } from '../types/Treatment'
import {
  hasAppointmentConflict,
  hasPatientAppointmentOnDate,
  isPastTimeForDate,
} from './appointmentConflicts'
import { doesAppointmentFitBusinessHours } from './appointmentDuration'
import { appointmentTimeSlots } from './appointmentTimeSlots'
import {
  getBusinessDayScheduleForDate,
  validateAppointmentAgainstBusinessHours,
} from './businessHours'
import {
  getActiveTreatments,
  isValidTreatmentDuration,
} from './treatmentUtils'

export const appointmentInitialStatuses: AppointmentStatus[] = [
  'pending',
  'confirmed',
]

export function validateAppointmentForm(
  values: AppointmentFormValues,
  referenceDate = new Date(),
  treatments: Treatment[] = [],
  businessHours?: BusinessHoursSettings,
  appointments: Appointment[] = [],
  appointmentIdToIgnore?: number,
): AppointmentFormErrors {
  const errors: AppointmentFormErrors = {}

  if (values.patientId === null) {
    errors.patient = 'Selecciona un paciente.'
  } else if (
    hasPatientAppointmentOnDate(
      appointments,
      values.patientId,
      values.date,
      appointmentIdToIgnore,
    )
  ) {
    errors.patient = 'Este paciente ya tiene una cita activa ese día.'
  }

  if (!values.date) {
    errors.date = 'Selecciona una fecha.'
  } else if (isPastDate(values.date, referenceDate)) {
    errors.date = 'La fecha no puede ser anterior a hoy.'
  }

  const canValidateBusinessHours =
    businessHours && values.date && !errors.date
  const businessHoursError = canValidateBusinessHours
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
    !businessHours &&
    !appointmentTimeSlots.some((slot) => slot.value === values.time)
  ) {
    errors.time = 'Selecciona una hora valida.'
  } else if (
    hasAppointmentConflict(
      appointments,
      values.date,
      values.time,
      appointmentIdToIgnore,
    )
  ) {
    errors.time = 'Ya existe una cita programada para esa fecha y hora.'
  }

  const activeTreatments = getActiveTreatments(treatments)
  const selectedTreatment = activeTreatments.find(
    (treatment) => treatment.name === values.treatment,
  )

  if (!values.treatment.trim()) {
    errors.treatment = 'Ingresa el motivo o tratamiento.'
  } else if (activeTreatments.length === 0) {
    errors.treatment = 'Activa al menos un tratamiento en Configuracion.'
  } else if (!selectedTreatment) {
    errors.treatment = 'Selecciona un tratamiento valido.'
  } else if (!isValidTreatmentDuration(selectedTreatment.durationMinutes)) {
    errors.treatment = 'El tratamiento seleccionado no tiene una duración válida.'
  } else if (
    values.durationMinutes !== selectedTreatment.durationMinutes ||
    !isValidTreatmentDuration(values.durationMinutes)
  ) {
    errors.treatment = 'El tratamiento seleccionado no tiene una duración válida.'
  } else if (
    businessHours &&
    values.date &&
    values.time &&
    !errors.date &&
    !errors.time &&
    !doesAppointmentFitBusinessHours(
      getBusinessDayScheduleForDate(businessHours, values.date),
      values.time,
      values.durationMinutes,
    )
  ) {
    errors.time = 'La duración del tratamiento excede el horario de atención.'
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
