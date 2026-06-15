import { PatientForm } from '../components/PatientForm'
import { PatientsList } from '../components/PatientsList'
import type { Patient, PatientFormValues } from '../types/Patient'

interface PatientsViewProps {
  emptyMessage?: string
  errorMessage?: string
  initialMode?: 'list' | 'new'
  isLoading?: boolean
  onViewPatient: (patientId: Patient['id']) => void
  patients: Patient[]
  onCreatePatient: (
    values: PatientFormValues,
  ) => Promise<{ error?: string; success: boolean }>
}

export function PatientsView({
  emptyMessage,
  errorMessage,
  initialMode = 'list',
  isLoading,
  onViewPatient,
  patients,
  onCreatePatient,
}: PatientsViewProps) {
  if (initialMode === 'new') {
    return <PatientForm onCreatePatient={onCreatePatient} />
  }

  return (
    <section className="patients-view">
      <PatientsList
        emptyMessage={emptyMessage}
        errorMessage={errorMessage}
        isLoading={isLoading}
        onViewPatient={onViewPatient}
        patients={patients}
      />
      <PatientForm onCreatePatient={onCreatePatient} />
    </section>
  )
}
