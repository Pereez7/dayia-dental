import { useState } from 'react'
import './App.css'
import { appointments as initialAppointments } from './data/appointments'
import { patients as initialPatients } from './data/patients'
import { treatments as initialTreatments } from './data/treatments'
import { AppLayout } from './layout/AppLayout'
import type { AppSection } from './layout/navigation'
import type { Appointment, AppointmentFormValues } from './types/Appointment'
import type { Patient, PatientFormValues } from './types/Patient'
import type { Treatment } from './types/Treatment'
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
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)

  function handleCreatePatient(values: PatientFormValues) {
    const newPatient: Patient = {
      id: Date.now(),
      fullName: `${values.firstName.trim()} ${values.lastName.trim()}`,
      phone: `${values.countryCode}${values.localPhone.trim()}`,
      email: values.email.trim() || undefined,
      birthDate: values.birthDate || undefined,
      lastVisit: 'Sin registro',
      nextAppointment: null,
      status: 'active',
    }

    setPatients((currentPatients) => [newPatient, ...currentPatients])
  }

  function handleCreateAppointment(values: AppointmentFormValues) {
    const newAppointment: Appointment = {
      id: Date.now(),
      patientId: values.patientId ?? undefined,
      date: values.date,
      time: values.time,
      patient: values.patient,
      treatment: values.treatment,
      status: values.status,
    }

    setAppointments((currentAppointments) => [
      ...currentAppointments,
      newAppointment,
    ])
    setActiveSection('appointments-agenda')
  }

  function handleViewPatient(patientId: number) {
    setSelectedPatientId(patientId)
    setActiveSection('patient-detail')
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
          onBackToList={handleBackToPatientsList}
          patient={selectedPatient}
        />
      )
    }

    if (activeSection === 'appointments-agenda') {
      return (
        <AppointmentsView
          appointments={appointments}
          mode="agenda"
          patients={patients}
          treatments={treatments}
        />
      )
    }

    if (activeSection === 'appointment-new') {
      return (
        <AppointmentsView
          appointments={appointments}
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
      return <WhatsAppRemindersView />
    }

    if (activeSection === 'settings') {
      return (
        <SettingsView
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

export default App
