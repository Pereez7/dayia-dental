import { useMemo, useState } from 'react'
import { PatientOdontogram } from '../components/PatientOdontogram'
import type {
  OdontogramEntry,
  OdontogramFormValues,
  OdontogramSaveResult,
  ToothCode,
} from '../types/Odontogram'
import type { Patient, PatientId } from '../types/Patient'
import { getOdontogramEntriesByPatient } from '../utils/odontogram'

interface OdontogramViewProps {
  entries: OdontogramEntry[]
  errorMessage?: string
  isLoading?: boolean
  isPatientsLoading?: boolean
  onSaveTooth: (
    patientId: PatientId,
    toothCode: ToothCode,
    values: OdontogramFormValues,
  ) => Promise<OdontogramSaveResult> | OdontogramSaveResult
  onSelectPatient: (patientId: PatientId | null) => void
  patients: Patient[]
  selectedPatientId: PatientId | null
}

export function OdontogramView({
  entries,
  errorMessage = '',
  isLoading = false,
  isPatientsLoading = false,
  onSaveTooth,
  onSelectPatient,
  patients,
  selectedPatientId,
}: OdontogramViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es')
  const filteredPatients = useMemo(
    () =>
      patients.filter((patient) =>
        patient.fullName.toLocaleLowerCase('es').includes(normalizedSearch),
      ),
    [normalizedSearch, patients],
  )
  const selectedPatient = patients.find(
    (patient) => patient.id === selectedPatientId,
  )
  const patientEntries = selectedPatient
    ? getOdontogramEntriesByPatient(entries, selectedPatient.id)
    : []

  function handlePatientChange(value: string) {
    const patient = patients.find(({ id }) => String(id) === value)
    onSelectPatient(patient?.id ?? null)
  }

  return (
    <section className="odontogram-view view-stack">
      <header className="odontogram-view-heading">
        <div>
          <p className="eyebrow">Registro dental</p>
          <h2>Odontograma</h2>
          <p>
            Estado actual de las piezas permanentes del paciente seleccionado.
          </p>
        </div>
        <span className="status-pill">FDI adulto</span>
      </header>

      <section className="odontogram-patient-selector" aria-label="Seleccionar paciente">
        <label>
          <span>Buscar paciente</span>
          <input
            disabled={isPatientsLoading}
            placeholder="Nombre del paciente"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label>
          <span>Paciente</span>
          <select
            disabled={isPatientsLoading || patients.length === 0}
            value={selectedPatient ? String(selectedPatient.id) : ''}
            onChange={(event) => handlePatientChange(event.target.value)}
          >
            <option value="">Seleccionar paciente</option>
            {filteredPatients.map((patient) => (
              <option key={patient.id} value={String(patient.id)}>
                {patient.fullName}
              </option>
            ))}
          </select>
        </label>
      </section>

      {isPatientsLoading ? (
        <div className="odontogram-view-state" aria-live="polite">
          <strong>Cargando pacientes...</strong>
        </div>
      ) : !selectedPatient ? (
        <div className="odontogram-view-state">
          <strong>Selecciona un paciente para registrar su odontograma.</strong>
          <span>Las piezas y observaciones se mantienen separadas por paciente.</span>
        </div>
      ) : isLoading ? (
        <div className="odontogram-view-state" aria-live="polite">
          <strong>Cargando odontograma de {selectedPatient.fullName}...</strong>
        </div>
      ) : (
        <section className="odontogram-workspace">
          <div className="odontogram-patient-context">
            <div>
              <span>Paciente seleccionado</span>
              <strong>{selectedPatient.fullName}</strong>
            </div>
            <span>{selectedPatient.phone}</span>
          </div>

          <PatientOdontogram
            key={String(selectedPatient.id)}
            entries={patientEntries}
            errorMessage={errorMessage}
            onSaveTooth={(toothCode, values) =>
              onSaveTooth(selectedPatient.id, toothCode, values)
            }
          />
        </section>
      )}
    </section>
  )
}
