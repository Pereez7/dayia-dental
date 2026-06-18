import { useEffect, useState } from 'react'
import './App.css'
import { useAuth } from './auth/AuthContext'
import { appointments as initialAppointments } from './data/appointments'
import { businessHours as initialBusinessHours } from './data/businessHours'
import { calendarExceptions as initialCalendarExceptions } from './data/calendarExceptions'
import { clinicalRecords as initialClinicalRecords } from './data/clinicalRecords'
import { odontogramEntries as initialOdontogramEntries } from './data/odontogram'
import { patients as initialPatients } from './data/patients'
import { treatments as initialTreatments } from './data/treatments'
import { AppLayout } from './layout/AppLayout'
import type { AppSection } from './layout/navigation'
import {
  createPatient,
  getPatientsByClinic,
  mapPatientFormValuesToPatientInput,
} from './services/patientsService'
import {
  createAppointment as createAppointmentInSupabase,
  getAppointmentsByClinic,
  mapAppointmentFormValuesToAppointmentInput,
  rescheduleAppointment as rescheduleAppointmentInSupabase,
  updateAppointmentStatus as updateAppointmentStatusInSupabase,
} from './services/appointmentsService'
import {
  createCalendarException,
  createTreatment as createTreatmentInSupabase,
  deleteCalendarException,
  getClosedBusinessHoursSettings,
  getBusinessHoursByClinic,
  getCalendarExceptionsByClinic,
  getTreatmentsByClinic,
  saveBusinessHours,
  setTreatmentActive,
  updateTreatment as updateTreatmentInSupabase,
} from './services/settingsService'
import {
  cancelRemindersForAppointment,
  getRemindersByClinic,
  markReminderFailed,
  markReminderSent,
  upsertRemindersForAppointment,
} from './services/remindersService'
import {
  getWhatsappSettingsByClinic,
  upsertWhatsappSettings,
} from './services/whatsappSettingsService'
import type {
  Appointment,
  AppointmentFormValues,
  AppointmentId,
  AppointmentStatus,
} from './types/Appointment'
import type {
  BusinessHoursSettings,
  CalendarException,
  CalendarExceptionFormValues,
  CalendarExceptionId,
} from './types/BusinessHours'
import type {
  ClinicalRecord,
  ClinicalRecordFormValues,
} from './types/ClinicalRecord'
import type {
  OdontogramEntry,
  OdontogramFormValues,
} from './types/Odontogram'
import type { Patient, PatientFormValues, PatientId } from './types/Patient'
import type { Reminder } from './types/Reminder'
import type { Treatment, TreatmentId } from './types/Treatment'
import type {
  WhatsappSettings,
  WhatsappSettingsFormValues,
} from './types/WhatsApp'
import { upsertOdontogramEntry } from './utils/odontogram'
import { canRescheduleAppointment } from './utils/appointmentActions'
import {
  appendAppointmentLogEntry,
  createAppointmentCancelledLog,
  createAppointmentConfirmedLog,
  createAppointmentCreatedLog,
} from './utils/appointmentChangeLog'
import type { AppointmentReasonPayload } from './utils/appointmentReasons'
import { rescheduleAppointment } from './utils/appointmentReschedule'
import { getTreatmentDuration } from './utils/treatmentUtils'
import {
  getStoredActiveSection,
  saveActiveSection,
} from './utils/activeSectionStorage'
import { AppointmentsView } from './views/AppointmentsView'
import { ClinicalHistoryView } from './views/ClinicalHistoryView'
import { DashboardView } from './views/DashboardView'
import { OdontogramView } from './views/OdontogramView'
import { PatientDetailView } from './views/PatientDetailView'
import { PatientsView } from './views/PatientsView'
import { SettingsView } from './views/SettingsView'
import { WhatsAppRemindersView } from './views/WhatsAppRemindersView'

function App() {
  const { currentClinic, isDemoMode } = useAuth()
  const [activeSection, setActiveSection] = useState<AppSection>(() =>
    getStoredActiveSection(),
  )
  const [appointments, setAppointments] = useState<Appointment[]>(() =>
    isDemoMode ? initialAppointments : [],
  )
  const [isAppointmentsLoading, setIsAppointmentsLoading] = useState(
    () => !isDemoMode,
  )
  const [appointmentsError, setAppointmentsError] = useState('')
  const [patients, setPatients] = useState<Patient[]>(() =>
    isDemoMode ? initialPatients : [],
  )
  const [isPatientsLoading, setIsPatientsLoading] = useState(
    () => !isDemoMode,
  )
  const [patientsError, setPatientsError] = useState('')
  const [treatments, setTreatments] =
    useState<Treatment[]>(initialTreatments)
  const [businessHours, setBusinessHours] =
    useState<BusinessHoursSettings>(initialBusinessHours)
  const [isBusinessHoursConfigured, setIsBusinessHoursConfigured] =
    useState(true)
  const [settingsError, setSettingsError] = useState('')
  const [treatmentsError, setTreatmentsError] = useState('')
  const [businessHoursError, setBusinessHoursError] = useState('')
  const [calendarExceptions, setCalendarExceptions] =
    useState<CalendarException[]>(initialCalendarExceptions)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isRemindersLoading, setIsRemindersLoading] = useState(true)
  const [remindersError, setRemindersError] = useState('')
  const [whatsappSettings, setWhatsappSettings] =
    useState<WhatsappSettings | null>(null)
  const [whatsappSettingsError, setWhatsappSettingsError] = useState('')
  const [clinicalRecords, setClinicalRecords] =
    useState<ClinicalRecord[]>(initialClinicalRecords)
  const [odontogramEntries, setOdontogramEntries] =
    useState<OdontogramEntry[]>(initialOdontogramEntries)
  const [selectedPatientId, setSelectedPatientId] = useState<PatientId | null>(
    null,
  )
  const isDashboardDataLoading =
    !isDemoMode && (isPatientsLoading || isAppointmentsLoading)

  useEffect(() => {
    saveActiveSection(activeSection)
  }, [activeSection])

  useEffect(() => {
    let isMounted = true

    async function loadPatients() {
      if (isDemoMode) {
        setPatients(initialPatients)
        setIsPatientsLoading(false)
        setPatientsError('')
        return
      }

      if (!currentClinic?.id) {
        setPatients([])
        setIsPatientsLoading(false)
        setPatientsError('No hay consultorio activo para cargar pacientes.')
        return
      }

      setIsPatientsLoading(true)
      setPatientsError('')

      const { data, error } = await getPatientsByClinic(currentClinic.id)

      if (!isMounted) {
        return
      }

      if (error) {
        setPatients([])
        setPatientsError(error)
        setIsPatientsLoading(false)
        return
      }

      setPatients(data ?? [])
      setIsPatientsLoading(false)
    }

    loadPatients()

    return () => {
      isMounted = false
    }
  }, [currentClinic?.id, isDemoMode])

  useEffect(() => {
    let isMounted = true

    async function loadReminders() {
      if (isDemoMode) {
        setReminders([])
        setIsRemindersLoading(false)
        setRemindersError('')
        return
      }

      if (!currentClinic?.id) {
        setReminders([])
        setIsRemindersLoading(false)
        setRemindersError('No hay consultorio activo para cargar recordatorios.')
        return
      }

      setIsRemindersLoading(true)
      setRemindersError('')

      const { data, error } = await getRemindersByClinic(
        currentClinic.id,
        appointments,
        patients,
      )

      if (!isMounted) {
        return
      }

      if (error) {
        setReminders([])
        setRemindersError(error)
        setIsRemindersLoading(false)
        return
      }

      setReminders(data ?? [])
      setIsRemindersLoading(false)
    }

    loadReminders()

    return () => {
      isMounted = false
    }
  }, [appointments, currentClinic?.id, isDemoMode, patients])

  useEffect(() => {
    let isMounted = true

    async function loadAppointments() {
      if (isDemoMode) {
        setAppointments(initialAppointments)
        setIsAppointmentsLoading(false)
        setAppointmentsError('')
        return
      }

      if (!currentClinic?.id) {
        setAppointments([])
        setIsAppointmentsLoading(false)
        setAppointmentsError('No hay consultorio activo para cargar citas.')
        return
      }

      setIsAppointmentsLoading(true)
      setAppointmentsError('')

      const { data, error } = await getAppointmentsByClinic(
        currentClinic.id,
        patients,
      )

      if (!isMounted) {
        return
      }

      if (error) {
        setAppointments([])
        setAppointmentsError(error)
        setIsAppointmentsLoading(false)
        return
      }

      setAppointments(data ?? [])
      setIsAppointmentsLoading(false)
    }

    loadAppointments()

    return () => {
      isMounted = false
    }
  }, [currentClinic?.id, isDemoMode, patients])

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      if (isDemoMode) {
        setTreatments(initialTreatments)
        setBusinessHours(initialBusinessHours)
        setCalendarExceptions(initialCalendarExceptions)
        setWhatsappSettings(null)
        setIsBusinessHoursConfigured(true)
        setSettingsError('')
        setTreatmentsError('')
        setBusinessHoursError('')
        setWhatsappSettingsError('')
        return
      }

      if (!currentClinic?.id) {
        setTreatments([])
        setBusinessHours(getClosedBusinessHoursSettings())
        setCalendarExceptions([])
        setWhatsappSettings(null)
        setIsBusinessHoursConfigured(false)
        setSettingsError('No hay consultorio activo para cargar configuración.')
        return
      }

      setSettingsError('')
      setTreatmentsError('')
      setBusinessHoursError('')
      setWhatsappSettingsError('')

      const [
        treatmentsResult,
        businessHoursResult,
        calendarExceptionsResult,
        whatsappSettingsResult,
      ] = await Promise.all([
        getTreatmentsByClinic(currentClinic.id),
        getBusinessHoursByClinic(currentClinic.id),
        getCalendarExceptionsByClinic(currentClinic.id),
        getWhatsappSettingsByClinic(currentClinic.id),
      ])

      if (!isMounted) {
        return
      }

      if (treatmentsResult.error) {
        setTreatments([])
        setTreatmentsError(treatmentsResult.error)
      } else {
        setTreatments(treatmentsResult.data ?? [])
      }

      if (businessHoursResult.error) {
        setBusinessHours(getClosedBusinessHoursSettings())
        setIsBusinessHoursConfigured(false)
        setBusinessHoursError(businessHoursResult.error)
      } else if (businessHoursResult.data) {
        setBusinessHours(businessHoursResult.data.settings)
        setIsBusinessHoursConfigured(businessHoursResult.data.isConfigured)
      }

      if (calendarExceptionsResult.error) {
        setCalendarExceptions([])
        setSettingsError(calendarExceptionsResult.error)
      } else {
        setCalendarExceptions(calendarExceptionsResult.data ?? [])
      }

      if (whatsappSettingsResult.error) {
        setWhatsappSettings(null)
        setWhatsappSettingsError(whatsappSettingsResult.error)
      } else {
        setWhatsappSettings(whatsappSettingsResult.data ?? null)
      }
    }

    loadSettings()

    return () => {
      isMounted = false
    }
  }, [currentClinic?.id, isDemoMode])

  async function handleCreatePatient(values: PatientFormValues) {
    if (isDemoMode) {
      const patientInput = mapPatientFormValuesToPatientInput(values)

      setPatients((currentPatients) => [
        {
          id: getNextNumericPatientId(currentPatients),
          fullName: `${patientInput.firstName} ${patientInput.lastName}`,
          phone: `${patientInput.countryCode}${patientInput.localPhone}`,
          email: patientInput.email,
          birthDate: patientInput.birthDate,
          lastVisit: 'Sin registro',
          nextAppointment: null,
          status: 'active',
        },
        ...currentPatients,
      ])
      setPatientsError('')

      return { success: true }
    }

    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para registrar pacientes.',
        success: false,
      }
    }

    const { data, error } = await createPatient(
      currentClinic.id,
      mapPatientFormValuesToPatientInput(values),
    )

    if (error || !data) {
      return {
        error: error ?? 'No pudimos registrar el paciente.',
        success: false,
      }
    }

    setPatients((currentPatients) => [data, ...currentPatients])
    setPatientsError('')

    return { success: true }
  }

  async function handleCreateAppointment(values: AppointmentFormValues) {
    if (!isDemoMode) {
      if (!currentClinic?.id) {
        return {
          error: 'No hay consultorio activo para registrar citas.',
          success: false,
        }
      }

      const appointmentInput = mapAppointmentFormValuesToAppointmentInput(values)

      if (!appointmentInput) {
        return {
          error: 'Selecciona un paciente registrado en Supabase.',
          success: false,
        }
      }

      const { data, error } = await createAppointmentInSupabase(
        currentClinic.id,
        appointmentInput,
        patients,
      )

      if (error || !data) {
        setAppointmentsError(error ?? 'No pudimos registrar la cita.')
        return {
          error: error ?? 'No pudimos registrar la cita.',
          success: false,
        }
      }

      const nextAppointments = [...appointments, data]
      const patient = patients.find((item) => item.id === data.patientId)
      const remindersResult = await upsertRemindersForAppointment(
        currentClinic.id,
        data,
        patient,
        nextAppointments,
        patients,
      )

      if (remindersResult.error) {
        setRemindersError(remindersResult.error)
      } else {
        setReminders((currentReminders) => [
          ...currentReminders,
          ...(remindersResult.data ?? []),
        ])
        setRemindersError('')
      }

      setAppointments(nextAppointments)
      setAppointmentsError('')
      setActiveSection('appointments-agenda')

      return { success: true }
    }

    setAppointments((currentAppointments) => {
      const nextAppointment: Appointment = {
        id: getNextNumericAppointmentId(currentAppointments),
        patientId: values.patientId ?? undefined,
        date: values.date,
        durationMinutes: getTreatmentDuration(treatments, values.treatment),
        time: values.time,
        patient: values.patient,
        treatment: values.treatment,
        status: values.status,
      }

      return [
        ...currentAppointments,
        appendAppointmentLogEntry(
          nextAppointment,
          createAppointmentCreatedLog(nextAppointment),
        ),
      ]
    })
    setAppointmentsError('')
    setActiveSection('appointments-agenda')

    return { success: true }
  }

  async function handleUpdateAppointmentStatus(
    appointmentId: AppointmentId,
    status: AppointmentStatus,
    reasonPayload?: AppointmentReasonPayload,
  ) {
    if (!isDemoMode) {
      if (!currentClinic?.id) {
        return {
          error: 'No hay consultorio activo para actualizar citas.',
          success: false,
        }
      }

      const currentAppointment = appointments.find(
        (appointment) => appointment.id === appointmentId,
      )

      const { data, error } = await updateAppointmentStatusInSupabase(
        currentClinic.id,
        appointmentId,
        status,
        reasonPayload,
        currentAppointment,
      )

      if (error || !data) {
        return {
          error: error ?? 'No pudimos actualizar la cita.',
          success: false,
        }
      }

      setAppointments((currentAppointments) =>
        currentAppointments.map((appointment) =>
          appointment.id === appointmentId ? data : appointment,
        ),
      )

      if (status === 'cancelled') {
        await cancelRemindersForAppointment(currentClinic.id, appointmentId)
        setReminders((currentReminders) =>
          currentReminders.map((reminder) =>
            reminder.appointmentId === appointmentId &&
            (reminder.status === 'pending' || reminder.status === 'scheduled')
              ? { ...reminder, status: 'cancelled' }
              : reminder,
          ),
        )
      } else {
        const nextAppointments = appointments.map((appointment) =>
          appointment.id === appointmentId ? data : appointment,
        )
        const patient = patients.find((item) => item.id === data.patientId)
        const remindersResult = await upsertRemindersForAppointment(
          currentClinic.id,
          data,
          patient,
          nextAppointments,
          patients,
        )

        if (remindersResult.error) {
          setRemindersError(remindersResult.error)
        } else {
          setReminders((currentReminders) => [
            ...currentReminders.filter(
              (reminder) =>
                reminder.appointmentId !== data.id ||
                (reminder.status !== 'pending' &&
                  reminder.status !== 'scheduled'),
            ),
            ...(remindersResult.data ?? []),
          ])
          setRemindersError('')
        }
      }

      setAppointmentsError('')

      return { success: true }
    }

    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) => {
        if (appointment.id !== appointmentId) {
          return appointment
        }

        if (appointment.status === status) {
          return appointment
        }

        const updatedAppointment: Appointment = {
          ...appointment,
          cancellationReason:
            status === 'cancelled'
              ? reasonPayload?.reason
              : appointment.cancellationReason,
          cancellationReasonDetail:
            status === 'cancelled'
              ? reasonPayload?.reasonDetail
              : appointment.cancellationReasonDetail,
          status,
        }

        if (status === 'confirmed') {
          return appendAppointmentLogEntry(
            updatedAppointment,
            createAppointmentConfirmedLog(),
          )
        }

        if (status === 'cancelled') {
          return appendAppointmentLogEntry(
            updatedAppointment,
            createAppointmentCancelledLog(reasonPayload),
          )
        }

        return updatedAppointment
      }),
    )

    setAppointmentsError('')

    return { success: true }
  }

  async function handleRescheduleAppointment(
    appointmentId: AppointmentId,
    date: string,
    time: string,
    reasonPayload?: AppointmentReasonPayload,
  ) {
    if (!isDemoMode) {
      if (!currentClinic?.id) {
        return {
          error: 'No hay consultorio activo para reprogramar citas.',
          success: false,
        }
      }

      const currentAppointment = appointments.find(
        (appointment) => appointment.id === appointmentId,
      )

      if (!currentAppointment) {
        return {
          error: 'No encontramos la cita seleccionada.',
          success: false,
        }
      }

      const { data, error } = await rescheduleAppointmentInSupabase(
        currentClinic.id,
        appointmentId,
        {
          date,
          durationMinutes: getTreatmentDuration(
            treatments,
            currentAppointment.treatment,
          ),
          reasonPayload,
          time,
        },
        currentAppointment,
      )

      if (error || !data) {
        return {
          error: error ?? 'No pudimos reprogramar la cita.',
          success: false,
        }
      }

      setAppointments((currentAppointments) =>
        currentAppointments.map((appointment) =>
          appointment.id === appointmentId ? data : appointment,
        ),
      )

      const nextAppointments = appointments.map((appointment) =>
        appointment.id === appointmentId ? data : appointment,
      )
      const patient = patients.find((item) => item.id === data.patientId)
      const remindersResult = await upsertRemindersForAppointment(
        currentClinic.id,
        data,
        patient,
        nextAppointments,
        patients,
      )

      if (remindersResult.error) {
        setRemindersError(remindersResult.error)
      } else {
        setReminders((currentReminders) => [
          ...currentReminders.filter(
            (reminder) =>
              reminder.appointmentId !== data.id ||
              (reminder.status !== 'pending' &&
                reminder.status !== 'scheduled'),
          ),
          ...(remindersResult.data ?? []),
        ])
        setRemindersError('')
      }

      setAppointmentsError('')

      return { success: true }
    }

    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) =>
        appointment.id === appointmentId &&
        canRescheduleAppointment(appointment.status)
          ? rescheduleAppointment(
              appointment,
              {
                date,
                reason: '',
                reasonDetail: '',
                time,
              },
              reasonPayload,
            )
          : appointment,
      ),
    )

    setAppointmentsError('')

    return { success: true }
  }

  async function handleCreateTreatment(values: Omit<Treatment, 'id'>) {
    if (isDemoMode) {
      setTreatments((currentTreatments) => [
        ...currentTreatments,
        {
          ...values,
          id: getNextNumericTreatmentId(currentTreatments),
        },
      ])
      setTreatmentsError('')

      return { success: true }
    }

    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para guardar tratamientos.',
        success: false,
      }
    }

    const { data, error } = await createTreatmentInSupabase(
      currentClinic.id,
      values,
    )

    if (error || !data) {
      setTreatmentsError(error ?? 'No pudimos guardar el tratamiento.')
      return {
        error: error ?? 'No pudimos guardar el tratamiento.',
        success: false,
      }
    }

    setTreatments((currentTreatments) => [...currentTreatments, data])
    setTreatmentsError('')

    return { success: true }
  }

  async function handleUpdateTreatment(
    treatmentId: TreatmentId,
    values: Omit<Treatment, 'id'>,
  ) {
    if (isDemoMode) {
      setTreatments((currentTreatments) =>
        currentTreatments.map((treatment) =>
          treatment.id === treatmentId ? { ...treatment, ...values } : treatment,
        ),
      )
      setTreatmentsError('')

      return { success: true }
    }

    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para actualizar tratamientos.',
        success: false,
      }
    }

    const { data, error } = await updateTreatmentInSupabase(
      currentClinic.id,
      treatmentId,
      values,
    )

    if (error || !data) {
      return {
        error: error ?? 'No pudimos actualizar el tratamiento.',
        success: false,
      }
    }

    setTreatments((currentTreatments) =>
      currentTreatments.map((treatment) =>
        treatment.id === treatmentId ? data : treatment,
      ),
    )
    setTreatmentsError('')

    return { success: true }
  }

  async function handleSetTreatmentActive(
    treatmentId: TreatmentId,
    isActive: boolean,
  ) {
    if (isDemoMode) {
      setTreatments((currentTreatments) =>
        currentTreatments.map((treatment) =>
          treatment.id === treatmentId ? { ...treatment, isActive } : treatment,
        ),
      )
      setTreatmentsError('')

      return { success: true }
    }

    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para actualizar tratamientos.',
        success: false,
      }
    }

    const { data, error } = await setTreatmentActive(
      currentClinic.id,
      treatmentId,
      isActive,
    )

    if (error || !data) {
      return {
        error: error ?? 'No pudimos actualizar el tratamiento.',
        success: false,
      }
    }

    setTreatments((currentTreatments) =>
      currentTreatments.map((treatment) =>
        treatment.id === treatmentId ? data : treatment,
      ),
    )
    setTreatmentsError('')

    return { success: true }
  }

  async function handleSaveBusinessHours(settings: BusinessHoursSettings) {
    if (isDemoMode) {
      setBusinessHours(settings)
      setIsBusinessHoursConfigured(true)
      setBusinessHoursError('')

      return { success: true }
    }

    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para guardar horarios.',
        success: false,
      }
    }

    const { data, error } = await saveBusinessHours(currentClinic.id, settings)

    if (error || !data) {
      setBusinessHoursError(error ?? 'No pudimos guardar los horarios.')
      return {
        error: error ?? 'No pudimos guardar los horarios.',
        success: false,
      }
    }

    setBusinessHours(data)
    setIsBusinessHoursConfigured(true)
    setBusinessHoursError('')

    return { success: true }
  }

  async function handleCreateCalendarException(
    values: CalendarExceptionFormValues,
  ) {
    if (isDemoMode) {
      const nextException: CalendarException = {
        date: values.date,
        id: getNextNumericCalendarExceptionId(calendarExceptions),
        reason: values.reason || undefined,
        reasonDetail:
          values.reason === 'other'
            ? values.reasonDetail.trim() || undefined
            : undefined,
        type: values.type,
        ...(values.type === 'special-hours'
          ? {
              endTime: values.endTime,
              startTime: values.startTime,
            }
          : {}),
      }

      setCalendarExceptions((currentExceptions) => [
        nextException,
        ...currentExceptions,
      ])
      setSettingsError('')

      return { success: true }
    }

    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para guardar excepciones.',
        success: false,
      }
    }

    const { data, error } = await createCalendarException(
      currentClinic.id,
      values,
    )

    if (error || !data) {
      setSettingsError(error ?? 'No pudimos guardar la excepción.')
      return {
        error: error ?? 'No pudimos guardar la excepción.',
        success: false,
      }
    }

    setCalendarExceptions((currentExceptions) => [data, ...currentExceptions])
    setSettingsError('')

    return { success: true }
  }

  async function handleDeleteCalendarException(
    exceptionId: CalendarExceptionId,
  ) {
    if (isDemoMode) {
      setCalendarExceptions((currentExceptions) =>
        currentExceptions.filter((exception) => exception.id !== exceptionId),
      )
      setSettingsError('')

      return { success: true }
    }

    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para eliminar excepciones.',
        success: false,
      }
    }

    const { error } = await deleteCalendarException(
      currentClinic.id,
      exceptionId,
    )

    if (error) {
      setSettingsError(error)
      return { error, success: false }
    }

    setCalendarExceptions((currentExceptions) =>
      currentExceptions.filter((exception) => exception.id !== exceptionId),
    )
    setSettingsError('')

    return { success: true }
  }

  async function handleSaveWhatsappSettings(
    values: WhatsappSettingsFormValues,
  ) {
    if (isDemoMode) {
      setWhatsappSettings({
        businessAccountId: values.businessAccountId,
        isConnected: values.isConnected,
        phoneNumber: values.phoneNumber,
        phoneNumberId: values.phoneNumberId,
        provider: values.provider,
      })
      setWhatsappSettingsError('')

      return { success: true }
    }

    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para guardar WhatsApp.',
        success: false,
      }
    }

    const { data, error } = await upsertWhatsappSettings(
      currentClinic.id,
      values,
    )

    if (error || !data) {
      setWhatsappSettingsError(error ?? 'No pudimos guardar WhatsApp.')
      return {
        error: error ?? 'No pudimos guardar WhatsApp.',
        success: false,
      }
    }

    setWhatsappSettings(data)
    setWhatsappSettingsError('')

    return { success: true }
  }

  async function handleMarkReminderSent(reminderId: string) {
    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para actualizar recordatorios.',
        success: false,
      }
    }

    const { data, error } = await markReminderSent(
      currentClinic.id,
      reminderId,
      appointments,
      patients,
    )

    if (error || !data) {
      return {
        error: error ?? 'No pudimos actualizar el recordatorio.',
        success: false,
      }
    }

    setReminders((currentReminders) =>
      currentReminders.map((reminder) =>
        reminder.id === reminderId ? data : reminder,
      ),
    )
    setRemindersError('')

    return { success: true }
  }

  async function handleMarkReminderFailed(reminderId: string) {
    if (!currentClinic?.id) {
      return {
        error: 'No hay consultorio activo para actualizar recordatorios.',
        success: false,
      }
    }

    const { data, error } = await markReminderFailed(
      currentClinic.id,
      reminderId,
      'Marcado manualmente como fallido.',
      appointments,
      patients,
    )

    if (error || !data) {
      return {
        error: error ?? 'No pudimos actualizar el recordatorio.',
        success: false,
      }
    }

    setReminders((currentReminders) =>
      currentReminders.map((reminder) =>
        reminder.id === reminderId ? data : reminder,
      ),
    )
    setRemindersError('')

    return { success: true }
  }

  function handleViewPatient(patientId: PatientId) {
    setSelectedPatientId(patientId)
    setActiveSection('patient-detail')
  }

  function handleCreateClinicalRecord(
    patientId: PatientId,
    values: ClinicalRecordFormValues,
  ) {
    setClinicalRecords((currentRecords) => [
      {
        id: getNextNumericId(currentRecords),
        patientId,
        date: values.date,
        reason: values.reason,
        diagnosis: values.diagnosis,
        treatment: values.treatment,
        notes: values.notes,
      },
      ...currentRecords,
    ])
  }

  function handleSaveOdontogramTooth(
    patientId: PatientId,
    toothNumber: number,
    values: OdontogramFormValues,
  ) {
    const toothStatus = values.status

    if (!toothStatus) {
      return
    }

    setOdontogramEntries((currentEntries) =>
      upsertOdontogramEntry(currentEntries, {
        id: getNextNumericId(currentEntries),
        patientId,
        toothNumber,
        status: toothStatus,
        notes: values.notes,
        updatedAt: getTodayDateInputValue(),
      }),
    )
  }

  function handleBackToPatientsList() {
    setActiveSection('patients-list')
  }

  function renderActiveView() {
    if (activeSection === 'patients-list') {
      return (
        <PatientsView
          emptyMessage="No hay pacientes registrados en este consultorio."
          errorMessage={patientsError}
          initialMode="list"
          isLoading={isPatientsLoading}
          onViewPatient={handleViewPatient}
          patients={patients}
          onCreatePatient={handleCreatePatient}
        />
      )
    }

    if (activeSection === 'patient-new') {
      return (
        <PatientsView
          emptyMessage="No hay pacientes registrados en este consultorio."
          errorMessage={patientsError}
          initialMode="new"
          isLoading={isPatientsLoading}
          onViewPatient={handleViewPatient}
          patients={patients}
          onCreatePatient={handleCreatePatient}
        />
      )
    }

    if (activeSection === 'patient-detail') {
      const selectedPatient = patients.find(
        (patient) => patient.id === selectedPatientId,
      )

      if (!selectedPatient) {
        return (
          <PatientsView
            emptyMessage="No hay pacientes registrados en este consultorio."
            errorMessage={patientsError}
            initialMode="list"
            isLoading={isPatientsLoading}
            onViewPatient={handleViewPatient}
            patients={patients}
            onCreatePatient={handleCreatePatient}
          />
        )
      }

      return (
        <PatientDetailView
          appointments={appointments}
          clinicalRecords={clinicalRecords}
          odontogramEntries={odontogramEntries}
          onCreateClinicalRecord={(values) =>
            handleCreateClinicalRecord(selectedPatient.id, values)
          }
          onSaveOdontogramTooth={(toothNumber, values) =>
            handleSaveOdontogramTooth(selectedPatient.id, toothNumber, values)
          }
          onBackToList={handleBackToPatientsList}
          patient={selectedPatient}
        />
      )
    }

    if (activeSection === 'appointments-agenda') {
      return (
        <AppointmentsView
          appointments={appointments}
          businessHours={businessHours}
          calendarExceptions={calendarExceptions}
          errorMessage={appointmentsError}
          isLoading={isAppointmentsLoading}
          mode="agenda"
          patients={patients}
          treatments={treatments}
          onRescheduleAppointment={handleRescheduleAppointment}
          onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
        />
      )
    }

    if (activeSection === 'appointment-new') {
      return (
        <AppointmentsView
          appointments={appointments}
          businessHours={businessHours}
          calendarExceptions={calendarExceptions}
          errorMessage={appointmentsError}
          isLoading={isAppointmentsLoading}
          mode="new"
          patients={patients}
          treatments={treatments}
          onCreateAppointment={handleCreateAppointment}
          onNavigateToAgenda={() => setActiveSection('appointments-agenda')}
        />
      )
    }

    if (activeSection === 'clinical-history') {
      return (
        <ClinicalHistoryView
          clinicalRecords={clinicalRecords}
          patients={patients}
          onViewPatient={handleViewPatient}
        />
      )
    }

    if (activeSection === 'odontogram') {
      return <OdontogramView />
    }

    if (activeSection === 'whatsapp-reminders') {
      return (
        <WhatsAppRemindersView
          appointments={appointments}
          errorMessage={remindersError}
          isLoading={!isDemoMode && isRemindersLoading}
          onMarkReminderFailed={handleMarkReminderFailed}
          onMarkReminderSent={handleMarkReminderSent}
          patients={patients}
          reminders={isDemoMode ? undefined : reminders}
        />
      )
    }

    if (activeSection === 'settings') {
      return (
        <SettingsView
          businessHours={businessHours}
          businessHoursError={businessHoursError}
          calendarExceptions={calendarExceptions}
          isBusinessHoursConfigured={isBusinessHoursConfigured}
          onBusinessHoursChange={handleSaveBusinessHours}
          onCreateCalendarException={handleCreateCalendarException}
          onCreateTreatment={handleCreateTreatment}
          onDeleteCalendarException={handleDeleteCalendarException}
          onSetTreatmentActive={handleSetTreatmentActive}
          onUpdateTreatment={handleUpdateTreatment}
          onWhatsappSettingsChange={handleSaveWhatsappSettings}
          settingsError={settingsError}
          treatments={treatments}
          treatmentsError={treatmentsError}
          whatsappSettings={whatsappSettings}
          whatsappSettingsError={whatsappSettingsError}
        />
      )
    }

    return (
      <DashboardView
        appointments={appointments}
        isLoading={isDashboardDataLoading}
        patients={patients}
      />
    )
  }

  return (
    <AppLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {renderActiveView()}
    </AppLayout>
  )
}

function getNextNumericId(items: { id: number }[]) {
  return Math.max(0, ...items.map((item) => item.id)) + 1
}

function getNextNumericPatientId(patients: Patient[]) {
  return (
    Math.max(
      0,
      ...patients
        .map((patient) => patient.id)
        .filter((patientId): patientId is number => typeof patientId === 'number'),
    ) + 1
  )
}

function getNextNumericAppointmentId(appointments: Appointment[]) {
  return (
    Math.max(
      0,
      ...appointments
        .map((appointment) => appointment.id)
        .filter(
          (appointmentId): appointmentId is number =>
            typeof appointmentId === 'number',
        ),
    ) + 1
  )
}

function getNextNumericTreatmentId(treatments: Treatment[]) {
  return (
    Math.max(
      0,
      ...treatments
        .map((treatment) => treatment.id)
        .filter(
          (treatmentId): treatmentId is number => typeof treatmentId === 'number',
        ),
    ) + 1
  )
}

function getNextNumericCalendarExceptionId(
  calendarExceptions: CalendarException[],
) {
  return (
    Math.max(
      0,
      ...calendarExceptions
        .map((calendarException) => calendarException.id)
        .filter(
          (calendarExceptionId): calendarExceptionId is number =>
            typeof calendarExceptionId === 'number',
        ),
    ) + 1
  )
}

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default App
