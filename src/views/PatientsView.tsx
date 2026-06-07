import { useState } from 'react'
import { PatientForm } from '../components/PatientForm'
import { PatientsList } from '../components/PatientsList'
import { patients as initialPatients } from '../data/patients'
import type { Patient, PatientFormValues } from '../types/Patient'

interface PatientsViewProps {
  initialMode?: 'list' | 'new'
}

export function PatientsView({ initialMode = 'list' }: PatientsViewProps) {
  const [patients, setPatients] = useState<Patient[]>(initialPatients)

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

  return (
    <>
      <PatientForm onCreatePatient={handleCreatePatient} />
      {initialMode === 'list' && <PatientsList patients={patients} />}
    </>
  )
}
