import { PatientForm } from '../components/PatientForm'
import { PatientsList } from '../components/PatientsList'
import type { Patient, PatientFormValues } from '../types/Patient'

interface PatientsViewProps {
  initialMode?: 'list' | 'new'
  onViewPatient: (patientId: number) => void
  patients: Patient[]
  onCreatePatient: (values: PatientFormValues) => void
}

export function PatientsView({
  initialMode = 'list',
  onViewPatient,
  patients,
  onCreatePatient,
}: PatientsViewProps) {
  if (initialMode === 'new') {
    return <PatientForm onCreatePatient={onCreatePatient} />
  }

  return (
    <section className="patients-view">
      <PatientsList onViewPatient={onViewPatient} patients={patients} />
      <PatientForm onCreatePatient={onCreatePatient} />
    </section>
  )
}
