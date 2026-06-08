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
  return (
    <>
      <PatientForm onCreatePatient={onCreatePatient} />
      {initialMode === 'list' && (
        <PatientsList onViewPatient={onViewPatient} patients={patients} />
      )}
    </>
  )
}
