import { useEffect, useState } from 'react'
import { PatientForm } from '../components/PatientForm'
import { PatientEditDialog } from '../components/PatientEditDialog'
import { PatientsList } from '../components/PatientsList'
import { Toast } from '../components/Toast'
import type { Patient, PatientFormValues } from '../types/Patient'

interface PatientsViewProps {
  emptyMessage?: string
  errorMessage?: string
  canEditPatients?: boolean
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
  onUpdatePatient?: (
    patientId: Patient['id'],
    values: PatientFormValues,
  ) => Promise<{ error?: string; success: boolean }>
}

export function PatientsView({
  emptyMessage,
  errorMessage,
  canEditPatients = false,
  initialMode = 'list',
  isLoading,
  onViewPatient,
  patients,
  onCreatePatient,
  onUpdatePatient,
}: PatientsViewProps) {
  const [highlightedPatientId, setHighlightedPatientId] = useState<
    Patient['id'] | null
  >(null)
  const [searchResetToken, setSearchResetToken] = useState(0)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [successMessage, setSuccessMessage] = useState('')

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

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => setSuccessMessage(''), 3200)

    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

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
        onEditPatient={
          canEditPatients
            ? (patientId) =>
                setEditingPatient(
                  patients.find((patient) => patient.id === patientId) ?? null,
                )
            : undefined
        }
        onViewPatient={onViewPatient}
        patients={patients}
      />
      <div id="patient-registration">
        <PatientForm onCreatePatient={handleCreatePatient} />
      </div>
      {editingPatient && onUpdatePatient && (
        <PatientEditDialog
          patient={editingPatient}
          patients={patients}
          onCancel={() => setEditingPatient(null)}
          onUpdatePatient={onUpdatePatient}
          onUpdated={() => {
            setEditingPatient(null)
            setSuccessMessage('Paciente actualizado correctamente.')
          }}
        />
      )}
      <Toast
        message={successMessage}
        tone="success"
        visible={Boolean(successMessage)}
      />
    </section>
  )
}
