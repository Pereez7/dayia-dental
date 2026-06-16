import { useEffect, useMemo, useState } from 'react'
import type {
  Appointment,
  AppointmentId,
  AppointmentStatus,
} from '../types/Appointment'
import type {
  BusinessHoursSettings,
  CalendarException,
} from '../types/BusinessHours'
import type { Patient } from '../types/Patient'
import type { Treatment } from '../types/Treatment'
import { getAvailableTimeOptionsByDuration } from '../utils/appointmentConflicts'
import { getAppointmentDuration } from '../utils/appointmentDuration'
import {
  canRescheduleAppointment,
  shouldCloseReschedulePanelAfterStatusChange,
  shouldCloseReschedulePanelOnToggle,
} from '../utils/appointmentActions'
import {
  appointmentCancellationReasonOptions,
  appointmentRescheduleReasonOptions,
  buildAppointmentReasonPayload,
  type AppointmentCancellationReason,
  type AppointmentReasonErrors,
  type AppointmentReasonPayload,
  type AppointmentReasonValues,
  type AppointmentRescheduleReason,
  hasAppointmentReasonErrors,
  maxAppointmentReasonDetailLength,
  validateAppointmentReason,
} from '../utils/appointmentReasons'
import {
  getAppointmentsForDate,
  getDateInputValue,
  getVisibleAgendaDays,
  summarizeAppointmentsByStatus,
} from '../utils/appointmentGroups'
import {
  type AppointmentRescheduleErrors,
  type AppointmentRescheduleValues,
  hasAppointmentRescheduleErrors,
  validateAppointmentReschedule,
} from '../utils/appointmentReschedule'
import {
  getCalendarExceptionForDate,
  getEffectiveBusinessHoursForDate,
} from '../utils/businessHours'
import { AppointmentAgendaCard } from './AppointmentAgendaCard'
import { ConfirmDialog } from './ConfirmDialog'
import { Toast, type ToastTone } from './Toast'

interface AppointmentsAgendaProps {
  appointments: Appointment[]
  businessHours: BusinessHoursSettings
  calendarExceptions: CalendarException[]
  errorMessage?: string
  isLoading?: boolean
  patients: Patient[]
  treatments: Treatment[]
  onRescheduleAppointment?: (
    appointmentId: AppointmentId,
    date: string,
    time: string,
    reasonPayload?: AppointmentReasonPayload,
  ) => Promise<AppointmentActionResult> | AppointmentActionResult | void
  onUpdateAppointmentStatus?: (
    appointmentId: AppointmentId,
    status: AppointmentStatus,
    reasonPayload?: AppointmentReasonPayload,
  ) => Promise<AppointmentActionResult> | AppointmentActionResult | void
}

interface AppointmentActionResult {
  error?: string
  success: boolean
}

const emptyRescheduleValues: AppointmentRescheduleValues = {
  date: '',
  reason: '',
  reasonDetail: '',
  time: '',
}

const emptyCancellationReasonValues: AppointmentReasonValues<AppointmentCancellationReason> =
  {
    reason: '',
    reasonDetail: '',
  }

export function AppointmentsAgenda({
  appointments,
  businessHours,
  calendarExceptions,
  errorMessage = '',
  isLoading = false,
  onRescheduleAppointment,
  onUpdateAppointmentStatus,
  patients,
  treatments,
}: AppointmentsAgendaProps) {
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue())
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<
    AppointmentId | null
  >(null)
  const [rescheduleValues, setRescheduleValues] =
    useState<AppointmentRescheduleValues>(emptyRescheduleValues)
  const [rescheduleErrors, setRescheduleErrors] =
    useState<AppointmentRescheduleErrors>({})
  const [rescheduleReasonErrors, setRescheduleReasonErrors] =
    useState<AppointmentReasonErrors>({})
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<ToastTone>('success')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [actionError, setActionError] = useState('')
  const [appointmentIdPendingCancellation, setAppointmentIdPendingCancellation] =
    useState<AppointmentId | null>(null)
  const [cancellationReasonValues, setCancellationReasonValues] =
    useState<AppointmentReasonValues<AppointmentCancellationReason>>(
      emptyCancellationReasonValues,
    )
  const [cancellationReasonErrors, setCancellationReasonErrors] =
    useState<AppointmentReasonErrors>({})
  const visibleDays = useMemo(
    () => getVisibleAgendaDays(appointments),
    [appointments],
  )
  const selectedAppointments = useMemo(
    () => getAppointmentsForDate(appointments, selectedDate),
    [appointments, selectedDate],
  )
  const statusSummary = summarizeAppointmentsByStatus(selectedAppointments)

  function getAppointmentPatient(appointment: Appointment) {
    if (appointment.patientId !== undefined) {
      return patients.find((patient) => patient.id === appointment.patientId)
    }

    return patients.find((patient) => patient.fullName === appointment.patient)
  }

  useEffect(() => {
    if (!isToastVisible) {
      return
    }

    const timeoutId = window.setTimeout(() => setIsToastVisible(false), 3200)

    return () => window.clearTimeout(timeoutId)
  }, [isToastVisible, toastMessage])

  useEffect(() => {
    if (isToastVisible || !toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => setToastMessage(''), 220)

    return () => window.clearTimeout(timeoutId)
  }, [isToastVisible, toastMessage])

  async function updateAppointmentStatus(
    appointmentId: AppointmentId,
    status: AppointmentStatus,
    reasonPayload?: AppointmentReasonPayload,
  ) {
    setActionError('')
    const result = await onUpdateAppointmentStatus?.(
      appointmentId,
      status,
      reasonPayload,
    )

    if (result && !result.success) {
      setActionError(result.error ?? 'No pudimos actualizar la cita.')
      setToastMessage(result.error ?? 'No pudimos actualizar la cita.')
      setToastTone('error')
      setIsToastVisible(true)
      return false
    }

    if (
      shouldCloseReschedulePanelAfterStatusChange(
        rescheduleAppointmentId,
        appointmentId,
        status,
      )
    ) {
      closeReschedulePanel()
    }
    setToastMessage(
      status === 'confirmed' ? 'Cita confirmada.' : 'Cita cancelada.',
    )
    setToastTone(status === 'confirmed' ? 'success' : 'warning')
    setIsToastVisible(true)

    return true
  }

  function requestAppointmentCancellation(appointmentId: AppointmentId) {
    closeReschedulePanel()
    setAppointmentIdPendingCancellation(appointmentId)
    setCancellationReasonValues(emptyCancellationReasonValues)
    setCancellationReasonErrors({})
  }

  function cancelAppointmentCancellation() {
    setAppointmentIdPendingCancellation(null)
    setCancellationReasonValues(emptyCancellationReasonValues)
    setCancellationReasonErrors({})
  }

  async function confirmAppointmentCancellation() {
    if (appointmentIdPendingCancellation === null) {
      return
    }

    const errors = validateAppointmentReason(cancellationReasonValues)
    setCancellationReasonErrors(errors)

    if (hasAppointmentReasonErrors(errors)) {
      return
    }

    const reasonPayload = buildAppointmentReasonPayload(
      cancellationReasonValues,
      appointmentCancellationReasonOptions,
    )

    const wasUpdated = await updateAppointmentStatus(
      appointmentIdPendingCancellation,
      'cancelled',
      reasonPayload,
    )

    if (!wasUpdated) {
      return
    }

    setAppointmentIdPendingCancellation(null)
    setCancellationReasonValues(emptyCancellationReasonValues)
    setCancellationReasonErrors({})
  }

  function startReschedule(appointment: Appointment) {
    if (
      shouldCloseReschedulePanelOnToggle(
        rescheduleAppointmentId,
        appointment.id,
      )
    ) {
      closeReschedulePanel()
      return
    }

    if (!canRescheduleAppointment(appointment.status)) {
      setRescheduleErrors({
        appointment: 'No puedes reprogramar una cita cancelada.',
      })
      setToastMessage('No puedes reprogramar una cita cancelada.')
      setToastTone('error')
      setIsToastVisible(true)
      return
    }

    setRescheduleAppointmentId(appointment.id)
    setRescheduleValues({
      date: appointment.date,
      reason: '',
      reasonDetail: '',
      time: appointment.time,
    })
    setRescheduleErrors({})
    setRescheduleReasonErrors({})
    setIsToastVisible(false)
  }

  function selectAgendaDate(date: string) {
    if (date !== selectedDate) {
      closeReschedulePanel()
    }

    setSelectedDate(date)
  }

  function resetRescheduleForm() {
    setRescheduleValues(emptyRescheduleValues)
    setRescheduleErrors({})
    setRescheduleReasonErrors({})
  }

  function closeReschedulePanel() {
    setRescheduleAppointmentId(null)
    resetRescheduleForm()
  }

  function updateRescheduleDate(appointment: Appointment, date: string) {
    const timeOptions = date
      ? getAvailableTimeOptionsByDuration(
          businessHours,
          appointments,
          date,
          getAppointmentDuration(appointment, treatments),
          {
            appointmentIdToIgnore: appointment.id,
            calendarExceptions,
            excludePastTimes: true,
            treatments,
          },
        )
      : []
    const daySchedule = date
      ? getEffectiveBusinessHoursForDate(
          businessHours,
          date,
          calendarExceptions,
        )
      : undefined
    const isClosed = Boolean(date) && daySchedule?.isOpen === false
    const calendarException = getCalendarExceptionForDate(
      calendarExceptions,
      date,
    )

    setRescheduleValues((currentValues) => ({
      ...currentValues,
      date,
      time:
        !isClosed && timeOptions.some((slot) => slot.value === currentValues.time)
          ? currentValues.time
          : '',
    }))
    setRescheduleErrors((currentErrors) => ({
      ...currentErrors,
      date: isClosed
        ? calendarException?.type === 'closed'
          ? 'El consultorio está cerrado por excepción ese día.'
          : 'El consultorio está cerrado ese día.'
        : undefined,
      patient: undefined,
      time: undefined,
    }))
  }

  function updateRescheduleTime(time: string) {
    setRescheduleValues((currentValues) => ({
      ...currentValues,
      time,
    }))
    setRescheduleErrors((currentErrors) => ({
      ...currentErrors,
      time: undefined,
    }))
  }

  function updateRescheduleReason(reason: AppointmentRescheduleReason | '') {
    setRescheduleValues((currentValues) => ({
      ...currentValues,
      reason,
      reasonDetail: reason === 'other' ? currentValues.reasonDetail : '',
    }))
    setRescheduleReasonErrors((currentErrors) => ({
      ...currentErrors,
      reason: undefined,
      reasonDetail: undefined,
    }))
  }

  function updateRescheduleReasonDetail(reasonDetail: string) {
    setRescheduleValues((currentValues) => ({
      ...currentValues,
      reasonDetail: reasonDetail.slice(0, maxAppointmentReasonDetailLength),
    }))
    setRescheduleReasonErrors((currentErrors) => ({
      ...currentErrors,
      reasonDetail: undefined,
    }))
  }

  function updateCancellationReason(reason: AppointmentCancellationReason | '') {
    setCancellationReasonValues((currentValues) => ({
      ...currentValues,
      reason,
      reasonDetail: reason === 'other' ? currentValues.reasonDetail : '',
    }))
    setCancellationReasonErrors((currentErrors) => ({
      ...currentErrors,
      reason: undefined,
      reasonDetail: undefined,
    }))
  }

  function updateCancellationReasonDetail(reasonDetail: string) {
    setCancellationReasonValues((currentValues) => ({
      ...currentValues,
      reasonDetail: reasonDetail.slice(0, maxAppointmentReasonDetailLength),
    }))
    setCancellationReasonErrors((currentErrors) => ({
      ...currentErrors,
      reasonDetail: undefined,
    }))
  }

  async function submitReschedule(appointment: Appointment) {
    const currentAppointment =
      appointments.find((item) => item.id === appointment.id) ?? appointment
    const errors = validateAppointmentReschedule(
      currentAppointment,
      rescheduleValues,
      appointments,
      businessHours,
      new Date(),
      treatments,
      calendarExceptions,
    )
    const reasonErrors = validateAppointmentReason(rescheduleValues)

    setRescheduleErrors(errors)
    setRescheduleReasonErrors(reasonErrors)

    if (
      hasAppointmentRescheduleErrors(errors) ||
      hasAppointmentReasonErrors(reasonErrors)
    ) {
      setToastMessage('')
      setIsToastVisible(false)
      return
    }

    setActionError('')
    const result = await onRescheduleAppointment?.(
      appointment.id,
      rescheduleValues.date,
      rescheduleValues.time,
      buildAppointmentReasonPayload(
        rescheduleValues,
        appointmentRescheduleReasonOptions,
      ),
    )

    if (result && !result.success) {
      setActionError(result.error ?? 'No pudimos reprogramar la cita.')
      setToastMessage(result.error ?? 'No pudimos reprogramar la cita.')
      setToastTone('error')
      setIsToastVisible(true)
      return
    }

    closeReschedulePanel()
    setToastMessage('Cita reprogramada.')
    setToastTone('warning')
    setIsToastVisible(true)
  }

  function getRescheduleTimeOptions(appointment: Appointment) {
    return rescheduleValues.date
        ? getAvailableTimeOptionsByDuration(
            businessHours,
            appointments,
            rescheduleValues.date,
            getAppointmentDuration(appointment, treatments),
            {
              appointmentIdToIgnore: appointment.id,
              calendarExceptions,
              excludePastTimes: true,
              treatments,
            },
          )
      : []
  }

  function isRescheduleDateClosed() {
    const daySchedule = rescheduleValues.date
      ? getEffectiveBusinessHoursForDate(
          businessHours,
          rescheduleValues.date,
          calendarExceptions,
        )
      : undefined

    return Boolean(rescheduleValues.date) && daySchedule?.isOpen === false
  }

  return (
    <section className="agenda-section" aria-label="Agenda de citas">
      <Toast message={toastMessage} tone={toastTone} visible={isToastVisible} />
      <ConfirmDialog
        cancelLabel="Volver"
        confirmLabel="Sí, cancelar cita"
        isOpen={appointmentIdPendingCancellation !== null}
        message="¿Seguro que deseas cancelar esta cita? Esta acción liberará el horario y la cita quedará registrada como cancelada."
        title="Cancelar cita"
        variant="danger"
        onCancel={cancelAppointmentCancellation}
        onConfirm={confirmAppointmentCancellation}
      >
        <div className="appointment-reason-fields">
          <label>
            <span>Motivo de cancelación</span>
            <select
              value={cancellationReasonValues.reason}
              onChange={(event) =>
                updateCancellationReason(
                  event.target.value as AppointmentCancellationReason | '',
                )
              }
            >
              <option value="">Seleccionar motivo</option>
              {appointmentCancellationReasonOptions.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </label>
          {cancellationReasonErrors.reason && (
            <p className="field-message field-message--error">
              {cancellationReasonErrors.reason}
            </p>
          )}

          {cancellationReasonValues.reason === 'other' && (
            <>
              <label>
                <span>Detalle</span>
                <textarea
                  maxLength={maxAppointmentReasonDetailLength}
                  rows={3}
                  value={cancellationReasonValues.reasonDetail}
                  placeholder="Describe brevemente el motivo"
                  onChange={(event) =>
                    updateCancellationReasonDetail(event.target.value)
                  }
                />
              </label>
              <p
                className={`appointment-reason-counter${
                  maxAppointmentReasonDetailLength -
                    cancellationReasonValues.reasonDetail.length <=
                  15
                    ? ' appointment-reason-counter--warning'
                    : ''
                }`}
              >
                {cancellationReasonValues.reasonDetail.length} /{' '}
                {maxAppointmentReasonDetailLength}
              </p>
            </>
          )}
          {cancellationReasonErrors.reasonDetail && (
            <p className="field-message field-message--error">
              {cancellationReasonErrors.reasonDetail}
            </p>
          )}
        </div>
      </ConfirmDialog>

      <div className="agenda-header">
        <div className="section-heading">
          <p className="eyebrow">Agenda diaria</p>
          <h2>Citas del consultorio</h2>
          <p className="section-description">
            Revisa la operacion de un dia y las citas programadas por hora.
          </p>
        </div>
      </div>

      {(errorMessage || actionError) && (
        <p className="field-message field-message--error">
          {actionError || errorMessage}
        </p>
      )}

      <div className="agenda-date-nav" aria-label="Seleccionar dia de agenda">
        {visibleDays.map((day) => (
          <button
            key={day.date}
            type="button"
            className="agenda-date-tab"
            aria-pressed={day.date === selectedDate}
            onClick={() => selectAgendaDate(day.date)}
          >
            <span>{day.primaryLabel}</span>
            <strong>{day.secondaryLabel}</strong>
          </button>
        ))}
      </div>

      <div className="agenda-summary">
        <div className="agenda-kpi agenda-kpi--total">
          <strong>{selectedAppointments.length}</strong>
          <span>Total</span>
        </div>
        <div className="agenda-kpi agenda-kpi--pending">
          <strong>{statusSummary.pending}</strong>
          <span>Pendientes</span>
        </div>
        <div className="agenda-kpi agenda-kpi--confirmed">
          <strong>{statusSummary.confirmed}</strong>
          <span>Confirmadas</span>
        </div>
        <div className="agenda-kpi agenda-kpi--rescheduled">
          <strong>{statusSummary.rescheduled}</strong>
          <span>Reprogramadas</span>
        </div>
        <div className="agenda-kpi agenda-kpi--cancelled">
          <strong>{statusSummary.cancelled}</strong>
          <span>Canceladas</span>
        </div>
      </div>

      {isLoading ? (
        <div className="agenda-empty-state">
          <h3>Cargando citas...</h3>
          <p>Estamos preparando la agenda del consultorio.</p>
        </div>
      ) : selectedAppointments.length > 0 ? (
        <div className="agenda-list" aria-label="Citas del dia seleccionado">
          {selectedAppointments.map((appointment) => (
            <AppointmentAgendaCard
              appointment={appointment}
              key={appointment.id}
              onCancel={() => requestAppointmentCancellation(appointment.id)}
              onConfirm={() => updateAppointmentStatus(appointment.id, 'confirmed')}
              onCloseReschedulePanel={closeReschedulePanel}
              onReschedule={() => startReschedule(appointment)}
              onRescheduleDateChange={(date) =>
                updateRescheduleDate(appointment, date)
              }
              onRescheduleSubmit={() => submitReschedule(appointment)}
              onRescheduleReasonChange={updateRescheduleReason}
              onRescheduleReasonDetailChange={updateRescheduleReasonDetail}
              onRescheduleTimeChange={updateRescheduleTime}
              patient={getAppointmentPatient(appointment)}
              rescheduleDateIsClosed={isRescheduleDateClosed()}
              rescheduleErrors={rescheduleErrors}
              rescheduleMinDate={getDateInputValue()}
              rescheduleReasonErrors={rescheduleReasonErrors}
              rescheduleReasonOptions={appointmentRescheduleReasonOptions}
              rescheduleTimeOptions={getRescheduleTimeOptions(appointment)}
              rescheduleValues={rescheduleValues}
              showRescheduleForm={
                rescheduleAppointmentId === appointment.id &&
                canRescheduleAppointment(appointment.status)
              }
              treatments={treatments}
            />
          ))}
        </div>
      ) : (
        <div className="agenda-empty-state">
          <h3>No hay citas programadas para este dia.</h3>
          <p>Registra una nueva cita desde el acceso de Nueva cita.</p>
        </div>
      )}
    </section>
  )
}
