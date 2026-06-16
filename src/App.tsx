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
import type {
  Appointment,
  AppointmentFormValues,
  AppointmentStatus,
} from './types/Appointment'
import type {
  BusinessHoursSettings,
  CalendarException,
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
import type { Treatment } from './types/Treatment'
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
  const [activeSection, setActiveSection] = useState<AppSection>('dashboard')
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments)
  const [patients, setPatients] = useState<Patient[]>([])
  const [isPatientsLoading, setIsPatientsLoading] = useState(true)
  const [patientsError, setPatientsError] = useState('')
  const [treatments, setTreatments] =
    useState<Treatment[]>(initialTreatments)
  const [businessHours, setBusinessHours] =
    useState<BusinessHoursSettings>(initialBusinessHours)
  const [calendarExceptions, setCalendarExceptions] =
    useState<CalendarException[]>(initialCalendarExceptions)
  const [clinicalRecords, setClinicalRecords] =
    useState<ClinicalRecord[]>(initialClinicalRecords)
  const [odontogramEntries, setOdontogramEntries] =
    useState<OdontogramEntry[]>(initialOdontogramEntries)
  const [selectedPatientId, setSelectedPatientId] = useState<PatientId | null>(
    null,
  )

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

  async function handleCreatePatient(values: PatientFormValues) {
    if (isDemoMode) {
      setPatients((currentPatients) => [
        {
          id: getNextNumericPatientId(currentPatients),
          fullName: `${values.firstName.trim()} ${values.lastName.trim()}`,
          phone: `${values.countryCode}${values.localPhone.trim()}`,
          email: values.email.trim() || undefined,
          birthDate: values.birthDate || undefined,
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

  function handleCreateAppointment(values: AppointmentFormValues) {
    setAppointments((currentAppointments) => {
      const nextAppointment: Appointment = {
        id: getNextNumericId(currentAppointments),
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
    setActiveSection('appointments-agenda')
  }

  function handleUpdateAppointmentStatus(
    appointmentId: number,
    status: AppointmentStatus,
    reasonPayload?: AppointmentReasonPayload,
  ) {
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
  }

  function handleRescheduleAppointment(
    appointmentId: number,
    date: string,
    time: string,
    reasonPayload?: AppointmentReasonPayload,
  ) {
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
          patients={patients}
        />
      )
    }

    if (activeSection === 'settings') {
      return (
        <SettingsView
          businessHours={businessHours}
          calendarExceptions={calendarExceptions}
          onCalendarExceptionsChange={setCalendarExceptions}
          onBusinessHoursChange={setBusinessHours}
          treatments={treatments}
          onTreatmentsChange={setTreatments}
        />
      )
    }

    return <DashboardView appointments={appointments} patients={patients} />
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

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default App
