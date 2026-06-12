import { describe, expect, it } from 'vitest'
import {
  appointmentCancellationReasonOptions,
  appointmentRescheduleReasonOptions,
  buildAppointmentReasonPayload,
  getAppointmentReasonDisplayText,
  hasAppointmentReasonErrors,
  normalizeAppointmentReasonDetail,
  validateAppointmentReason,
} from './appointmentReasons'

describe('validateAppointmentReason', () => {
  it('does not allow cancelling without a reason', () => {
    const errors = validateAppointmentReason({
      reason: '',
      reasonDetail: '',
    })

    expect(errors.reason).toBe('Selecciona un motivo.')
    expect(hasAppointmentReasonErrors(errors)).toBe(true)
  })

  it('does not allow cancelling with empty Other detail', () => {
    const errors = validateAppointmentReason({
      reason: 'other',
      reasonDetail: '   ',
    })

    expect(errors.reasonDetail).toBe('Escribe el motivo.')
  })

  it('does not allow rescheduling without a reason', () => {
    const errors = validateAppointmentReason({
      reason: '',
      reasonDetail: '',
    })

    expect(errors.reason).toBe('Selecciona un motivo.')
  })

  it('does not allow rescheduling with empty Other detail', () => {
    const errors = validateAppointmentReason({
      reason: 'other',
      reasonDetail: '',
    })

    expect(errors.reasonDetail).toBe('Escribe el motivo.')
  })
})

describe('buildAppointmentReasonPayload', () => {
  it('builds a cancellation reason payload', () => {
    expect(
      buildAppointmentReasonPayload(
        {
          reason: 'patient-requested-cancellation',
          reasonDetail: '',
        },
        appointmentCancellationReasonOptions,
      ),
    ).toEqual({
      reason: 'Paciente solicitó cancelar',
    })
  })

  it('builds a reschedule reason payload', () => {
    expect(
      buildAppointmentReasonPayload(
        {
          reason: 'doctor-availability',
          reasonDetail: '',
        },
        appointmentRescheduleReasonOptions,
      ),
    ).toEqual({
      reason: 'Cambio de disponibilidad del doctor',
    })
  })

  it('normalizes Other detail before saving it', () => {
    expect(
      buildAppointmentReasonPayload(
        {
          reason: 'other',
          reasonDetail: '  paciente   viaja  mañana ',
        },
        appointmentCancellationReasonOptions,
      ),
    ).toEqual({
      reason: 'Otro',
      reasonDetail: 'Paciente viaja mañana',
    })
  })
})

describe('normalizeAppointmentReasonDetail', () => {
  it('normalizes and limits the detail text', () => {
    const detail = normalizeAppointmentReasonDetail(
      '  CAMBIO '.repeat(20),
    )

    expect(detail).toHaveLength(80)
    expect(detail.startsWith('Cambio')).toBe(true)
  })
})

describe('getAppointmentReasonDisplayText', () => {
  it('prefers detail text when available', () => {
    expect(getAppointmentReasonDisplayText('Otro', 'Paciente viaja')).toBe(
      'Paciente viaja',
    )
  })

  it('uses the selected reason when there is no detail', () => {
    expect(getAppointmentReasonDisplayText('Solicitud del paciente')).toBe(
      'Solicitud del paciente',
    )
  })
})
