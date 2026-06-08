import { PatientForm } from '../components/PatientForm'
import { PatientsList } from '../components/PatientsList'
import type { Patient, PatientFormValues } from '../types/Patient'

interface PatientsViewProps {
  initialMode?: 'list' | 'new'
  patients: Patient[]
  onCreatePatient: (values: PatientFormValues) => void
}

export function PatientsView({
  initialMode = 'list',
  patients,
  onCreatePatient,
}: PatientsViewProps) {
  return (
    <>
      <PatientForm onCreatePatient={onCreatePatient} />
      {initialMode === 'list' && <PatientsList patients={patients} />}
    </>
  )
}
