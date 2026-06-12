import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import type { AppointmentTimeSlot } from '../utils/appointmentTimeSlots'
import { getAppointmentStatusActions } from '../utils/appointmentActions'
import {
  formatAppointmentTime,
  getAppointmentStatusClassName,
  getAppointmentStatusLabel,
} from '../utils/appointmentFormatters'
import {
  getAppointmentReasonDisplayText,
  maxAppointmentReasonDetailLength,
  type AppointmentReasonErrors,
  type AppointmentReasonOption,
  type AppointmentRescheduleReason,
} from '../utils/appointmentReasons'
import type {
  AppointmentRescheduleErrors,
  AppointmentRescheduleValues,
} from '../utils/appointmentReschedule'

interface AppointmentAgendaCardProps {
  appointment: Appointment
  onCancel: () => void
  onCancelReschedule: () => void
  onConfirm: () => void
  onReschedule: () => void
  onRescheduleDateChange: (date: string) => void
  onRescheduleReasonChange: (reason: AppointmentRescheduleReason | '') => void
  onRescheduleReasonDetailChange: (reasonDetail: string) => void
  onRescheduleSubmit: () => void
  onRescheduleTimeChange: (time: string) => void
  patient?: Patient
  rescheduleDateIsClosed: boolean
  rescheduleErrors: AppointmentRescheduleErrors
  rescheduleMinDate: string
  rescheduleReasonErrors: AppointmentReasonErrors
  rescheduleReasonOptions: AppointmentReasonOption<AppointmentRescheduleReason>[]
  rescheduleTimeOptions: AppointmentTimeSlot[]
  rescheduleValues: AppointmentRescheduleValues
  showRescheduleForm: boolean
}

export function AppointmentAgendaCard({
  appointment,
  onCancel,
  onCancelReschedule,
  onConfirm,
  onReschedule,
  onRescheduleDateChange,
  onRescheduleReasonChange,
  onRescheduleReasonDetailChange,
  onRescheduleSubmit,
  onRescheduleTimeChange,
  patient,
  rescheduleDateIsClosed,
  rescheduleErrors,
  rescheduleMinDate,
  rescheduleReasonErrors,
  rescheduleReasonOptions,
  rescheduleTimeOptions,
  rescheduleValues,
  showRescheduleForm,
}: AppointmentAgendaCardProps) {
  const appointmentTime = formatAppointmentTime(appointment.time)
  const statusClassName = getAppointmentStatusClassName(appointment.status)
  const statusLabel = getAppointmentStatusLabel(appointment.status)
  const availableActions = getAppointmentStatusActions(appointment.status)
  const reasonText =
    appointment.status === 'cancelled'
      ? getAppointmentReasonDisplayText(
          appointment.cancellationReason,
          appointment.cancellationReasonDetail,
        )
      : appointment.status === 'rescheduled'
        ? getAppointmentReasonDisplayText(
            appointment.rescheduleReason,
            appointment.rescheduleReasonDetail,
          )
        : ''

  return (
    <article className={`agenda-card${showRescheduleForm ? ' agenda-card--editing' : ''}`}>
      <div className="agenda-card-main">
        <time
          className="agenda-card-time"
          dateTime={`${appointment.date}T${appointment.time}`}
        >
          {appointmentTime}
        </time>

        <div className="agenda-card-body">
          <div className="agenda-card-primary">
            <div className="agenda-card-patient">
              <h3>{appointment.patient}</h3>
              <p>{patient?.phone ?? 'Telefono sin registro'}</p>
            </div>

            <span className={`agenda-status ${statusClassName}`}>
              {statusLabel}
            </span>
          </div>

          <p className="agenda-card-treatment">{appointment.treatment}</p>

          {reasonText && (
            <p className="agenda-card-reason">Motivo: {reasonText}</p>
          )}

          {availableActions.length > 0 && (
            <div className="agenda-card-actions" aria-label="Acciones de cita">
              {availableActions.includes('confirm') && (
                <button
                  className="agenda-card-action agenda-card-action--confirm"
                  type="button"
                  onClick={onConfirm}
                >
                  Confirmar
                </button>
              )}
              {availableActions.includes('reschedule') && (
                <button
                  className="agenda-card-action agenda-card-action--reschedule"
                  type="button"
                  onClick={onReschedule}
                >
                  Reprogramar
                </button>
              )}
              {availableActions.includes('cancel') && (
                <button
                  className="agenda-card-action agenda-card-action--cancel"
                  type="button"
                  onClick={onCancel}
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showRescheduleForm && (
        <div className="agenda-reschedule-panel">
          <div className="agenda-reschedule-grid">
            <label>
              <span>Nueva fecha</span>
              <input
                min={rescheduleMinDate}
                type="date"
                value={rescheduleValues.date}
                onChange={(event) =>
                  onRescheduleDateChange(event.target.value)
                }
              />
            </label>

            <label>
              <span>Nueva hora</span>
              <select
                disabled={
                  !rescheduleValues.date ||
                  rescheduleDateIsClosed ||
                  rescheduleTimeOptions.length === 0
                }
                value={rescheduleValues.time}
                onChange={(event) =>
                  onRescheduleTimeChange(event.target.value)
                }
              >
                <option value="">
                  {rescheduleDateIsClosed
                    ? 'Consultorio cerrado ese día'
                    : rescheduleValues.date
                      ? rescheduleTimeOptions.length > 0
                        ? 'Seleccionar horario'
                        : 'No hay horarios disponibles'
                      : 'Selecciona una fecha'}
                </option>
                {rescheduleTimeOptions.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="appointment-reason-fields appointment-reason-fields--inline">
            <label>
              <span>Motivo de reprogramación</span>
              <select
                value={rescheduleValues.reason}
                onChange={(event) =>
                  onRescheduleReasonChange(
                    event.target.value as AppointmentRescheduleReason | '',
                  )
                }
              >
                <option value="">Seleccionar motivo</option>
                {rescheduleReasonOptions.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            {rescheduleReasonErrors.reason && (
              <p className="field-message field-message--error">
                {rescheduleReasonErrors.reason}
              </p>
            )}

            {rescheduleValues.reason === 'other' && (
              <label>
                <span>Detalle</span>
                <textarea
                  maxLength={maxAppointmentReasonDetailLength}
                  rows={2}
                  value={rescheduleValues.reasonDetail}
                  placeholder="Describe brevemente el motivo"
                  onChange={(event) =>
                    onRescheduleReasonDetailChange(event.target.value)
                  }
                />
              </label>
            )}
            {rescheduleReasonErrors.reasonDetail && (
              <p className="field-message field-message--error">
                {rescheduleReasonErrors.reasonDetail}
              </p>
            )}
          </div>

          <div className="agenda-reschedule-messages">
            {rescheduleErrors.appointment && (
              <p className="field-message field-message--error">
                {rescheduleErrors.appointment}
              </p>
            )}
            {rescheduleErrors.date && (
              <p className="field-message field-message--error">
                {rescheduleErrors.date}
              </p>
            )}
            {rescheduleErrors.time && (
              <p className="field-message field-message--error">
                {rescheduleErrors.time}
              </p>
            )}
            {rescheduleErrors.patient && (
              <p className="field-message field-message--error">
                {rescheduleErrors.patient}
              </p>
            )}
            {!rescheduleErrors.time &&
              rescheduleValues.date &&
              !rescheduleDateIsClosed &&
              rescheduleTimeOptions.length === 0 && (
                <p className="field-message field-message--help">
                  No hay horarios disponibles para esta fecha.
                </p>
            )}
          </div>

          <div className="agenda-reschedule-actions">
            <button
              className="agenda-card-action agenda-card-action--reschedule"
              type="button"
              onClick={onRescheduleSubmit}
            >
              Guardar
            </button>
            <button
              className="agenda-card-action"
              type="button"
              onClick={onCancelReschedule}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
