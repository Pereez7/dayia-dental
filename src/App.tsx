import { useState } from 'react'
import './App.css'
import { AppLayout } from './layout/AppLayout'
import type { AppSection } from './layout/navigation'
import { AppointmentsView } from './views/AppointmentsView'
import { ClinicalHistoryView } from './views/ClinicalHistoryView'
import { DashboardView } from './views/DashboardView'
import { OdontogramView } from './views/OdontogramView'
import { PatientsView } from './views/PatientsView'
import { SettingsView } from './views/SettingsView'
import { WhatsAppRemindersView } from './views/WhatsAppRemindersView'

function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('dashboard')

  function renderActiveView() {
    if (activeSection === 'patients-list') {
      return <PatientsView initialMode="list" />
    }

    if (activeSection === 'patient-new') {
      return <PatientsView initialMode="new" />
    }

    if (activeSection === 'appointments-agenda') {
      return <AppointmentsView mode="agenda" />
    }

    if (activeSection === 'appointment-new') {
      return <AppointmentsView mode="new" />
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

    return <DashboardView />
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
