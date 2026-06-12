import { normalizeSentenceText } from './textNormalizers'

export type AppointmentCancellationReason =
  | 'patient-requested-cancellation'
  | 'patient-will-not-attend'
  | 'clinic-emergency'
  | 'registration-error'
  | 'other'

export type AppointmentRescheduleReason =
  | 'patient-request'
  | 'doctor-availability'
  | 'registration-error'
  | 'other'

export interface AppointmentReasonOption<TReason extends string> {
  label: string
  value: TReason
}

export interface AppointmentReasonValues<TReason extends string = string> {
  reason: TReason | ''
  reasonDetail: string
}

export interface AppointmentReasonPayload {
  reason: string
  reasonDetail?: string
}

export type AppointmentReasonErrors = Partial<
  Record<keyof AppointmentReasonValues, string>
>

export const maxAppointmentReasonDetailLength = 80

export const appointmentCancellationReasonOptions: AppointmentReasonOption<AppointmentCancellationReason>[] =
  [
    {
      label: 'Paciente solicitó cancelar',
      value: 'patient-requested-cancellation',
    },
    {
      label: 'Paciente no asistirá',
      value: 'patient-will-not-attend',
    },
    {
      label: 'Emergencia del consultorio',
      value: 'clinic-emergency',
    },
    {
      label: 'Error de registro',
      value: 'registration-error',
    },
    {
      label: 'Otro',
      value: 'other',
    },
  ]

export const appointmentRescheduleReasonOptions: AppointmentReasonOption<AppointmentRescheduleReason>[] =
  [
    {
      label: 'Solicitud del paciente',
      value: 'patient-request',
    },
    {
      label: 'Cambio de disponibilidad del doctor',
      value: 'doctor-availability',
    },
    {
      label: 'Error de registro',
      value: 'registration-error',
    },
    {
      label: 'Otro',
      value: 'other',
    },
  ]

export function validateAppointmentReason<TReason extends string>(
  values: AppointmentReasonValues<TReason>,
) {
  const errors: AppointmentReasonErrors = {}

  if (!values.reason) {
    errors.reason = 'Selecciona un motivo.'
  }

  if (values.reason === 'other' && !normalizeAppointmentReasonDetail(values.reasonDetail)) {
    errors.reasonDetail = 'Escribe el motivo.'
  }

  return errors
}

export function hasAppointmentReasonErrors(errors: AppointmentReasonErrors) {
  return Object.values(errors).some(Boolean)
}

export function buildAppointmentReasonPayload<TReason extends string>(
  values: AppointmentReasonValues<TReason>,
  options: AppointmentReasonOption<TReason>[],
): AppointmentReasonPayload {
  const selectedOption = options.find((option) => option.value === values.reason)

  if (!selectedOption) {
    return {
      reason: '',
    }
  }

  if (values.reason === 'other') {
    return {
      reason: selectedOption.label,
      reasonDetail: normalizeAppointmentReasonDetail(values.reasonDetail),
    }
  }

  return {
    reason: selectedOption.label,
  }
}

export function getAppointmentReasonDisplayText(
  reason?: string,
  reasonDetail?: string,
) {
  if (!reason) {
    return ''
  }

  return reasonDetail ? reasonDetail : reason
}

export function normalizeAppointmentReasonDetail(value: string) {
  return normalizeSentenceText(value).slice(0, maxAppointmentReasonDetailLength)
}
