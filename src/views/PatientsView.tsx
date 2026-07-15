import { useEffect, useState } from 'react'
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
  ) => Promise<{
    error?: string
    patientId?: Patient['id']
    success: boolean
  }>
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
  const [highlightedPatientId, setHighlightedPatientId] = useState<
    Patient['id'] | null
  >(null)
  const [searchResetToken, setSearchResetToken] = useState(0)

  useEffect(() => {
    if (highlightedPatientId === null) {
      return
    }

    const timeoutId = window.setTimeout(
      () => setHighlightedPatientId(null),
      3400,
    )

    return () => window.clearTimeout(timeoutId)
  }, [highlightedPatientId])

  async function handleCreatePatient(values: PatientFormValues) {
    const result = await onCreatePatient(values)

    if (result.success && result.patientId !== undefined) {
      setHighlightedPatientId(result.patientId)
      setSearchResetToken((currentToken) => currentToken + 1)
    }

    return result
  }

  if (initialMode === 'new') {
    return <PatientForm onCreatePatient={handleCreatePatient} />
  }

  return (
    <section className="patients-view patients-view--split">
      <a
        className="secondary-action patients-mobile-registration-link"
        href="#patient-registration"
      >
        Registrar nuevo paciente
      </a>
      <PatientsList
        key={searchResetToken}
        emptyMessage={emptyMessage}
        errorMessage={errorMessage}
        highlightedPatientId={highlightedPatientId}
        isLoading={isLoading}
        onViewPatient={onViewPatient}
        patients={patients}
      />
      <div id="patient-registration">
        <PatientForm onCreatePatient={handleCreatePatient} />
      </div>
    </section>
  )
}
