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
import {
  filterOdontogramPatients,
  findOdontogramPatientById,
  syncOdontogramPatientSelection,
} from '../utils/odontogramPatientSearch'
import { normalizeSearchText } from '../utils/textNormalizers'

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

interface OdontogramSearchResultsProps {
  onSelectPatient: (patient: Patient) => void
  patients: Patient[]
  selectedPatientId: PatientId | null
}

export function OdontogramSearchResults({
  onSelectPatient,
  patients,
  selectedPatientId,
}: OdontogramSearchResultsProps) {
  return (
    <div
      className="odontogram-search-results"
      id="odontogram-search-results"
      role="listbox"
    >
      {patients.length > 0 ? (
        patients.map((patient) => (
          <button
            aria-selected={patient.id === selectedPatientId}
            className="odontogram-search-result"
            key={patient.id}
            role="option"
            type="button"
            onClick={() => onSelectPatient(patient)}
          >
            <strong>{patient.fullName}</strong>
            <span>
              {[patient.phone, patient.email].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))
      ) : (
        <p className="odontogram-search-empty">
          No se encontraron pacientes.
        </p>
      )}
    </div>
  )
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
  const [searchTerm, setSearchTerm] = useState(
    () =>
      patients.find((patient) => patient.id === selectedPatientId)?.fullName ??
      '',
  )
  const filteredPatients = useMemo(
    () => filterOdontogramPatients(patients, searchTerm),
    [patients, searchTerm],
  )
  const selectedPatient = patients.find(
    (patient) => patient.id === selectedPatientId,
  )
  const hasSearchTerm = Boolean(searchTerm.trim())
  const isSearchSynchronized = Boolean(
    selectedPatient &&
      normalizeSearchText(selectedPatient.fullName) ===
        normalizeSearchText(searchTerm),
  )
  const showSearchResults = hasSearchTerm && !isSearchSynchronized
  const selectPatients =
    selectedPatient &&
    !filteredPatients.some((patient) => patient.id === selectedPatient.id)
      ? [selectedPatient, ...filteredPatients]
      : filteredPatients
  const patientEntries = selectedPatient
    ? getOdontogramEntriesByPatient(entries, selectedPatient.id)
    : []

  function selectPatient(patient: Patient) {
    syncOdontogramPatientSelection(patient, setSearchTerm, onSelectPatient)
  }

  function handlePatientChange(value: string) {
    const patient = findOdontogramPatientById(patients, value)

    if (patient) {
      selectPatient(patient)
      return
    }

    setSearchTerm('')
    onSelectPatient(null)
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

      <section
        className="odontogram-patient-selector"
        aria-label="Seleccionar paciente"
      >
        <div className="odontogram-search-control">
          <label htmlFor="odontogram-patient-search">Buscar paciente</label>
          <input
            aria-controls="odontogram-search-results"
            aria-expanded={showSearchResults}
            autoComplete="off"
            disabled={isPatientsLoading}
            id="odontogram-patient-search"
            placeholder="Nombre, teléfono o email"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          {showSearchResults && (
            <OdontogramSearchResults
              onSelectPatient={selectPatient}
              patients={filteredPatients}
              selectedPatientId={selectedPatientId}
            />
          )}
        </div>

        <label>
          <span>Paciente</span>
          <select
            disabled={isPatientsLoading || patients.length === 0}
            value={selectedPatient ? String(selectedPatient.id) : ''}
            onChange={(event) => handlePatientChange(event.target.value)}
          >
            <option value="">Seleccionar paciente</option>
            {selectPatients.map((patient) => (
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
          <strong>
            Selecciona un paciente de la lista para registrar su odontograma.
          </strong>
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
              <span>Paciente seleccionado:</span>
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
