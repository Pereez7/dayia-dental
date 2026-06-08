import { useState } from 'react'
import './App.css'
import { appointments as initialAppointments } from './data/appointments'
import { AppLayout } from './layout/AppLayout'
import type { AppSection } from './layout/navigation'
import type { Appointment, AppointmentFormValues } from './types/Appointment'
import { AppointmentsView } from './views/AppointmentsView'
import { ClinicalHistoryView } from './views/ClinicalHistoryView'
import { DashboardView } from './views/DashboardView'
import { OdontogramView } from './views/OdontogramView'
import { PatientsView } from './views/PatientsView'
import { SettingsView } from './views/SettingsView'
import { WhatsAppRemindersView } from './views/WhatsAppRemindersView'

function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('dashboard')
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments)

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

  function renderActiveView() {
    if (activeSection === 'patients-list') {
      return <PatientsView initialMode="list" />
    }

    if (activeSection === 'patient-new') {
      return <PatientsView initialMode="new" />
    }

    if (activeSection === 'appointments-agenda') {
      return <AppointmentsView appointments={appointments} mode="agenda" />
    }

    if (activeSection === 'appointment-new') {
      return (
        <AppointmentsView
          appointments={appointments}
          mode="new"
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
      return <SettingsView />
    }

    return <DashboardView appointments={appointments} />
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
