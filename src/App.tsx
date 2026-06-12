import { useState } from 'react'
import './App.css'
import { appointments as initialAppointments } from './data/appointments'
import { businessHours as initialBusinessHours } from './data/businessHours'
import { clinicalRecords as initialClinicalRecords } from './data/clinicalRecords'
import { odontogramEntries as initialOdontogramEntries } from './data/odontogram'
import { patients as initialPatients } from './data/patients'
import { treatments as initialTreatments } from './data/treatments'
import { AppLayout } from './layout/AppLayout'
import type { AppSection } from './layout/navigation'
import type {
  Appointment,
  AppointmentFormValues,
  AppointmentStatus,
} from './types/Appointment'
import type { BusinessHoursSettings } from './types/BusinessHours'
import type {
  ClinicalRecord,
  ClinicalRecordFormValues,
} from './types/ClinicalRecord'
import type {
  OdontogramEntry,
  OdontogramFormValues,
} from './types/Odontogram'
import type { Patient, PatientFormValues } from './types/Patient'
import type { Treatment } from './types/Treatment'
import { upsertOdontogramEntry } from './utils/odontogram'
import { canRescheduleAppointment } from './utils/appointmentActions'
import type { AppointmentReasonPayload } from './utils/appointmentReasons'
import { rescheduleAppointment } from './utils/appointmentReschedule'
import { AppointmentsView } from './views/AppointmentsView'
import { ClinicalHistoryView } from './views/ClinicalHistoryView'
import { DashboardView } from './views/DashboardView'
import { OdontogramView } from './views/OdontogramView'
import { PatientDetailView } from './views/PatientDetailView'
import { PatientsView } from './views/PatientsView'
import { SettingsView } from './views/SettingsView'
import { WhatsAppRemindersView } from './views/WhatsAppRemindersView'

function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('dashboard')
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments)
  const [patients, setPatients] = useState<Patient[]>(initialPatients)
  const [treatments, setTreatments] =
    useState<Treatment[]>(initialTreatments)
  const [businessHours, setBusinessHours] =
    useState<BusinessHoursSettings>(initialBusinessHours)
  const [clinicalRecords, setClinicalRecords] =
    useState<ClinicalRecord[]>(initialClinicalRecords)
  const [odontogramEntries, setOdontogramEntries] =
    useState<OdontogramEntry[]>(initialOdontogramEntries)
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)

  function handleCreatePatient(values: PatientFormValues) {
    setPatients((currentPatients) => [
      {
        id: getNextNumericId(currentPatients),
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
  }

  function handleCreateAppointment(values: AppointmentFormValues) {
    setAppointments((currentAppointments) => [
      ...currentAppointments,
      {
        id: getNextNumericId(currentAppointments),
        patientId: values.patientId ?? undefined,
        date: values.date,
        time: values.time,
        patient: values.patient,
        treatment: values.treatment,
        status: values.status,
      },
    ])
    setActiveSection('appointments-agenda')
  }

  function handleUpdateAppointmentStatus(
    appointmentId: number,
    status: AppointmentStatus,
    reasonPayload?: AppointmentReasonPayload,
  ) {
    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) =>
        appointment.id === appointmentId
          ? {
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
          : appointment,
      ),
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

  function handleViewPatient(patientId: number) {
    setSelectedPatientId(patientId)
    setActiveSection('patient-detail')
  }

  function handleCreateClinicalRecord(
    patientId: number,
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
    patientId: number,
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
          initialMode="list"
          onViewPatient={handleViewPatient}
          patients={patients}
          onCreatePatient={handleCreatePatient}
        />
      )
    }

    if (activeSection === 'patient-new') {
      return (
        <PatientsView
          initialMode="new"
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
            initialMode="list"
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
          mode="new"
          patients={patients}
          treatments={treatments}
          onCreateAppointment={handleCreateAppointment}
          onNavigateToAgenda={() => setActiveSection('appointments-agenda')}
        />
      )
    }

    if (activeSection === 'clinical-history') {
      return <ClinicalHistoryView />
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

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default App
