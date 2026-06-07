import { useState } from 'react'
import './App.css'
import { AppointmentsOverview } from './components/AppointmentsOverview'
import { Header } from './components/Header'
import { PatientForm } from './components/PatientForm'
import { PatientsList } from './components/PatientsList'
import { appointments } from './data/appointments'
import { patients as initialPatients } from './data/patients'
import type { Patient, PatientFormValues } from './types/Patient'

function App() {
  const [patients, setPatients] = useState<Patient[]>(initialPatients)

  function handleCreatePatient(values: PatientFormValues) {
    const newPatient: Patient = {
      id: Date.now(),
      fullName: `${values.firstName.trim()} ${values.lastName.trim()}`,
      phone: values.phone.trim(),
      email: values.email.trim() || undefined,
      birthDate: values.birthDate || undefined,
      lastVisit: 'Sin registro',
      nextAppointment: null,
      status: 'active',
    }

    setPatients((currentPatients) => [newPatient, ...currentPatients])
  }

  return (
    <main className="app-shell">
      <Header />
      <AppointmentsOverview appointments={appointments} />
      <PatientForm onCreatePatient={handleCreatePatient} />
      <PatientsList patients={patients} />
    </main>
  )
}

export default App
