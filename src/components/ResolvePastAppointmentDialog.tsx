import { useState } from 'react'
import type {
  Appointment,
  AppointmentId,
  AppointmentStatus,
} from '../types/Appointment'
import type {
  BusinessHoursSettings,
  CalendarException,
} from '../types/BusinessHours'
import type { Treatment } from '../types/Treatment'
import type { AppointmentReasonPayload } from '../utils/appointmentReasons'
import { getAvailableTimeOptionsByDuration } from '../utils/appointmentConflicts'
import { getDateInputValue } from '../utils/appointmentGroups'
import { getEffectiveBusinessHoursForDate } from '../utils/businessHours'
import { formatAppDate } from '../utils/dateFormatters'
import { isAppointmentDateTimePast } from '../utils/reminderExpiration'
import { normalizeAppointmentReasonDetail } from '../utils/appointmentReasons'
import {
  getActiveTreatments,
  getTreatmentDuration,
} from '../utils/treatmentUtils'
import { ConfirmDialog } from './ConfirmDialog'

export interface AppointmentResolutionResult {
  error?: string
  success: boolean
}

type ResolutionAction = 'cancelled' | 'completed' | 'no_show' | 'rescheduled'

interface ResolvePastAppointmentDialogProps {
  appointment: Appointment | null
  appointments: Appointment[]
  businessHours: BusinessHoursSettings
  calendarExceptions: CalendarException[]
  isOpen: boolean
  treatments: Treatment[]
  onCancel: () => void
  onResolved: (message: string) => void
  onReschedule: (
    appointmentId: AppointmentId,
    date: string,
    time: string,
    reasonPayload: AppointmentReasonPayload,
  ) => Promise<AppointmentResolutionResult> | AppointmentResolutionResult
  onUpdateStatus: (
    appointmentId: AppointmentId,
    status: AppointmentStatus,
    reasonPayload?: AppointmentReasonPayload,
  ) => Promise<AppointmentResolutionResult> | AppointmentResolutionResult
}

interface ResolutionFeedback {
  message: string
  tone: 'error' | 'warning'
}

const actionOptions: Array<{
  description: string
  label: string
  value: ResolutionAction
}> = [
  {
    description: 'Cierra la cita como atención realizada.',
    label: 'Marcar atendida',
    value: 'completed',
  },
  {
    description: 'Registra que el paciente no se presentó.',
    label: 'Marcar no asistió',
    value: 'no_show',
  },
  {
    description: 'Mueve la cita y genera una nueva cola de recordatorios.',
    label: 'Reprogramar',
    value: 'rescheduled',
  },
  {
    description: 'Cierra la cita y cancela recordatorios todavía activos.',
    label: 'Cancelar cita',
    value: 'cancelled',
  },
]

export function ResolvePastAppointmentDialog({
  appointment,
  appointments,
  businessHours,
  calendarExceptions,
  isOpen,
  treatments,
  onCancel,
  onResolved,
  onReschedule,
  onUpdateStatus,
}: ResolvePastAppointmentDialogProps) {
  const [action, setAction] = useState<ResolutionAction>('completed')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState<ResolutionFeedback | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!appointment) {
    return null
  }

  const targetAppointment = appointment
  const requiresSchedule = action === 'rescheduled'
  const requiresReason = action === 'rescheduled' || action === 'cancelled'
  const activeTreatments = getActiveTreatments(treatments)
  const durationMinutes =
    targetAppointment.durationMinutes ??
    getTreatmentDuration(activeTreatments, targetAppointment.treatment)
  const selectedDaySchedule = date
    ? getEffectiveBusinessHoursForDate(
        businessHours,
        date,
        calendarExceptions,
      )
    : undefined
  const selectedDateIsClosed =
    Boolean(date) && selectedDaySchedule?.isOpen === false
  const availableTimeOptions = date
    ? getAvailableTimeOptionsByDuration(
        businessHours,
        appointments,
        date,
        durationMinutes,
        {
          appointmentIdToIgnore: targetAppointment.id,
          calendarExceptions,
          excludePastTimes: true,
          treatments: activeTreatments,
        },
      )
    : []
  const humanAppointmentDate = formatAppDate(
    `${targetAppointment.date}T${targetAppointment.time}:00`,
  )

  async function submitResolution() {
    if (isSubmitting) {
      return
    }

    const normalizedReason = normalizeAppointmentReasonDetail(reason)

    if (requiresReason && !normalizedReason) {
      setFeedback({
        message: 'Escribe el motivo para continuar.',
        tone: 'warning',
      })
      return
    }

    if (requiresSchedule && (!date || !time)) {
      setFeedback({
        message: 'Selecciona una nueva fecha y hora disponible.',
        tone: 'warning',
      })
      return
    }

    if (
      requiresSchedule &&
      date === targetAppointment.date &&
      time === targetAppointment.time
    ) {
      setFeedback({
        message: 'La nueva fecha u hora debe ser diferente de la cita actual.',
        tone: 'warning',
      })
      return
    }

    if (requiresSchedule && isAppointmentDateTimePast(date, time)) {
      setFeedback({
        message: 'La nueva fecha y hora deben estar en el futuro.',
        tone: 'warning',
      })
      return
    }

    if (
      requiresSchedule &&
      !availableTimeOptions.some((slot) => slot.value === time)
    ) {
      setFeedback({
        message: 'El horario seleccionado ya no está disponible.',
        tone: 'warning',
      })
      return
    }

    setFeedback(null)
    setIsSubmitting(true)

    let result: AppointmentResolutionResult

    try {
      const reasonPayload = normalizedReason
        ? { reason: normalizedReason }
        : undefined

      result =
        action === 'rescheduled'
          ? await onReschedule(
              targetAppointment.id,
              date,
              time,
              { reason: normalizedReason },
            )
          : await onUpdateStatus(targetAppointment.id, action, reasonPayload)
    } catch {
      result = {
        error: 'No pudimos completar la operación. Intenta nuevamente.',
        success: false,
      }
    } finally {
      setIsSubmitting(false)
    }

    if (!result.success) {
      setFeedback({
        message:
          result.error ??
          'No pudimos completar la operación. Intenta nuevamente.',
        tone: 'error',
      })
      return
    }

    onResolved(getResolutionSuccessMessage(action))
  }

  return (
    <ConfirmDialog
      cancelLabel="Volver"
      confirmLabel={isSubmitting ? 'Guardando...' : getConfirmLabel(action)}
      isConfirmDisabled={isSubmitting}
      isOpen={isOpen}
      message="Elige cómo cerrar esta cita vencida."
      size="wide"
      title="Resolver cita pasada"
      variant={action === 'cancelled' ? 'warning' : 'info'}
      onCancel={onCancel}
      onConfirm={submitResolution}
    >
      <p className="appointment-resolution-context">
        <strong>{targetAppointment.patient}</strong>
        <span> · {humanAppointmentDate}</span>
      </p>

      <div className="appointment-resolution-options" role="radiogroup">
        {actionOptions.map((option) => (
          <button
            aria-pressed={action === option.value}
            className="appointment-resolution-option"
            key={option.value}
            type="button"
            onClick={() => {
              setAction(option.value)
              setFeedback(null)
            }}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>

      {requiresSchedule && (
        <div className="appointment-resolution-schedule">
          <label>
            <span>Nueva fecha</span>
            <input
              min={getDateInputValue()}
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setTime('')
                setFeedback(null)
              }}
            />
          </label>
          <label>
            <span>Nueva hora</span>
            <select
              aria-describedby="appointment-resolution-time-help"
              disabled={
                !date || selectedDateIsClosed || availableTimeOptions.length === 0
              }
              value={time}
              onChange={(event) => {
                setTime(event.target.value)
                setFeedback(null)
              }}
            >
              <option value="">
                {selectedDateIsClosed
                  ? 'Consultorio cerrado ese día'
                  : date
                    ? availableTimeOptions.length > 0
                      ? 'Seleccionar horario'
                      : 'No hay horarios disponibles'
                    : 'Selecciona una fecha'}
              </option>
              {availableTimeOptions.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </label>
          <p
            className="appointment-resolution-schedule-help"
            id="appointment-resolution-time-help"
          >
            {date && time
              ? `Nueva cita: ${formatAppDate(`${date}T${time}:00`)}`
              : date && !selectedDateIsClosed && availableTimeOptions.length === 0
                ? 'No hay horarios disponibles para esta fecha.'
                : `Duración estimada: ${durationMinutes} min`}
          </p>
        </div>
      )}

      {requiresReason && (
        <label className="appointment-resolution-reason">
          <span>Motivo</span>
          <textarea
            maxLength={120}
            placeholder={
              action === 'cancelled'
                ? 'Indica por qué se cancela la cita'
                : 'Indica por qué se reprograma la cita'
            }
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setFeedback(null)
            }}
          />
        </label>
      )}

      <div className="appointment-resolution-feedback" aria-live="polite">
        {feedback && (
          <p
            className={`appointment-resolution-alert appointment-resolution-alert--${feedback.tone}`}
            role="alert"
          >
            {feedback.message}
          </p>
        )}
      </div>
    </ConfirmDialog>
  )
}

function getConfirmLabel(action: ResolutionAction) {
  const labels: Record<ResolutionAction, string> = {
    cancelled: 'Cancelar cita',
    completed: 'Marcar atendida',
    no_show: 'Marcar no asistió',
    rescheduled: 'Guardar reprogramación',
  }

  return labels[action]
}

function getResolutionSuccessMessage(action: ResolutionAction) {
  const messages: Record<ResolutionAction, string> = {
    cancelled: 'Cita cancelada correctamente.',
    completed: 'Cita marcada como atendida.',
    no_show: 'Cita marcada como no asistida.',
    rescheduled: 'Cita reprogramada correctamente.',
  }

  return messages[action]
}
