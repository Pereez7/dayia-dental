import { useEffect, useMemo, useState } from 'react'
import type { Appointment, AppointmentStatus } from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import type { Patient } from '../types/Patient'
import { getAvailableTimeOptions } from '../utils/appointmentConflicts'
import {
  canRescheduleAppointment,
  shouldCloseReschedulePanelAfterStatusChange,
  shouldCloseReschedulePanelOnToggle,
} from '../utils/appointmentActions'
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
import { getBusinessDayScheduleForDate } from '../utils/businessHours'
import { AppointmentAgendaCard } from './AppointmentAgendaCard'
import { ConfirmDialog } from './ConfirmDialog'
import { Toast, type ToastTone } from './Toast'

interface AppointmentsAgendaProps {
  appointments: Appointment[]
  businessHours: BusinessHoursSettings
  patients: Patient[]
  onRescheduleAppointment?: (
    appointmentId: number,
    date: string,
    time: string,
  ) => void
  onUpdateAppointmentStatus?: (
    appointmentId: number,
    status: AppointmentStatus,
  ) => void
}

export function AppointmentsAgenda({
  appointments,
  businessHours,
  onRescheduleAppointment,
  onUpdateAppointmentStatus,
  patients,
}: AppointmentsAgendaProps) {
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue())
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<
    number | null
  >(null)
  const [rescheduleValues, setRescheduleValues] =
    useState<AppointmentRescheduleValues>({ date: '', time: '' })
  const [rescheduleErrors, setRescheduleErrors] =
    useState<AppointmentRescheduleErrors>({})
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<ToastTone>('success')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [appointmentIdPendingCancellation, setAppointmentIdPendingCancellation] =
    useState<number | null>(null)
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

  function updateAppointmentStatus(
    appointmentId: number,
    status: AppointmentStatus,
  ) {
    onUpdateAppointmentStatus?.(appointmentId, status)
    if (
      shouldCloseReschedulePanelAfterStatusChange(
        rescheduleAppointmentId,
        appointmentId,
        status,
      )
    ) {
      cancelReschedule()
    }
    setToastMessage(
      status === 'confirmed' ? 'Cita confirmada.' : 'Cita cancelada.',
    )
    setToastTone(status === 'confirmed' ? 'success' : 'warning')
    setIsToastVisible(true)
  }

  function requestAppointmentCancellation(appointmentId: number) {
    setAppointmentIdPendingCancellation(appointmentId)
  }

  function cancelAppointmentCancellation() {
    setAppointmentIdPendingCancellation(null)
  }

  function confirmAppointmentCancellation() {
    if (appointmentIdPendingCancellation === null) {
      return
    }

    updateAppointmentStatus(appointmentIdPendingCancellation, 'cancelled')
    setAppointmentIdPendingCancellation(null)
  }

  function startReschedule(appointment: Appointment) {
    if (
      shouldCloseReschedulePanelOnToggle(
        rescheduleAppointmentId,
        appointment.id,
      )
    ) {
      cancelReschedule()
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
      time: appointment.time,
    })
    setRescheduleErrors({})
    setIsToastVisible(false)
  }

  function selectAgendaDate(date: string) {
    if (date !== selectedDate) {
      cancelReschedule()
    }

    setSelectedDate(date)
  }

  function cancelReschedule() {
    setRescheduleAppointmentId(null)
    setRescheduleValues({ date: '', time: '' })
    setRescheduleErrors({})
  }

  function updateRescheduleDate(appointment: Appointment, date: string) {
    const timeOptions = date
      ? getAvailableTimeOptions(businessHours, appointments, date, {
          appointmentIdToIgnore: appointment.id,
          excludePastTimes: true,
        })
      : []
    const daySchedule = date
      ? getBusinessDayScheduleForDate(businessHours, date)
      : undefined
    const isClosed = Boolean(date) && daySchedule?.isOpen === false

    setRescheduleValues((currentValues) => ({
      date,
      time:
        !isClosed && timeOptions.some((slot) => slot.value === currentValues.time)
          ? currentValues.time
          : '',
    }))
    setRescheduleErrors((currentErrors) => ({
      ...currentErrors,
      date: isClosed ? 'El consultorio está cerrado ese día.' : undefined,
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

  function submitReschedule(appointment: Appointment) {
    const currentAppointment =
      appointments.find((item) => item.id === appointment.id) ?? appointment
    const errors = validateAppointmentReschedule(
      currentAppointment,
      rescheduleValues,
      appointments,
      businessHours,
    )

    setRescheduleErrors(errors)

    if (hasAppointmentRescheduleErrors(errors)) {
      if (errors.appointment) {
        setToastMessage(errors.appointment)
        setToastTone('error')
        setIsToastVisible(true)
      }

      return
    }

    onRescheduleAppointment?.(
      appointment.id,
      rescheduleValues.date,
      rescheduleValues.time,
    )
    cancelReschedule()
    setToastMessage('Cita reprogramada.')
    setToastTone('warning')
    setIsToastVisible(true)
  }

  function getRescheduleTimeOptions(appointment: Appointment) {
    return rescheduleValues.date
        ? getAvailableTimeOptions(
            businessHours,
            appointments,
            rescheduleValues.date,
            {
              appointmentIdToIgnore: appointment.id,
              excludePastTimes: true,
            },
          )
      : []
  }

  function isRescheduleDateClosed() {
    const daySchedule = rescheduleValues.date
      ? getBusinessDayScheduleForDate(businessHours, rescheduleValues.date)
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
      />

      <div className="agenda-header">
        <div className="section-heading">
          <p className="eyebrow">Agenda diaria</p>
          <h2>Citas del consultorio</h2>
          <p className="section-description">
            Revisa la operacion de un dia y las citas programadas por hora.
          </p>
        </div>
      </div>

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

      {selectedAppointments.length > 0 ? (
        <div className="agenda-list" aria-label="Citas del dia seleccionado">
          {selectedAppointments.map((appointment) => (
            <AppointmentAgendaCard
              appointment={appointment}
              key={appointment.id}
              onCancel={() => requestAppointmentCancellation(appointment.id)}
              onConfirm={() => updateAppointmentStatus(appointment.id, 'confirmed')}
              onCancelReschedule={cancelReschedule}
              onReschedule={() => startReschedule(appointment)}
              onRescheduleDateChange={(date) =>
                updateRescheduleDate(appointment, date)
              }
              onRescheduleSubmit={() => submitReschedule(appointment)}
              onRescheduleTimeChange={updateRescheduleTime}
              patient={getAppointmentPatient(appointment)}
              rescheduleDateIsClosed={isRescheduleDateClosed()}
              rescheduleErrors={rescheduleErrors}
              rescheduleMinDate={getDateInputValue()}
              rescheduleTimeOptions={getRescheduleTimeOptions(appointment)}
              rescheduleValues={rescheduleValues}
              showRescheduleForm={
                rescheduleAppointmentId === appointment.id &&
                canRescheduleAppointment(appointment.status)
              }
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
