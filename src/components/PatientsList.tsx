import { useState } from 'react'
import type { Patient } from '../types/Patient'
import { filterPatients } from '../utils/patientFilters'
import { PatientCard } from './PatientCard'

interface PatientsListProps {
  emptyMessage?: string
  errorMessage?: string
  isLoading?: boolean
  highlightedPatientId?: Patient['id'] | null
  onViewPatient: (patientId: Patient['id']) => void
  patients: Patient[]
}

export function PatientsList({
  emptyMessage = 'No hay pacientes registrados todavía.',
  errorMessage = '',
  highlightedPatientId = null,
  isLoading = false,
  onViewPatient,
  patients,
}: PatientsListProps) {
  const [searchText, setSearchText] = useState('')
  const filteredPatients = filterPatients(patients, searchText)

  function focusPatientForm() {
    document.getElementById('patient-first-name')?.focus()
  }

  return (
    <section className="patients-section" aria-label="Listado de pacientes">
      <div className="patients-header">
        <div className="section-heading">
          <p className="eyebrow">Pacientes</p>
          <h2>Pacientes recientes</h2>
        </div>

        <label className="patient-search">
          <span>Buscar paciente</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Nombre, apellido, teléfono o email"
            autoComplete="off"
          />
        </label>
      </div>

      {isLoading ? (
        <p className="empty-state">Cargando pacientes del consultorio...</p>
      ) : errorMessage ? (
        <p className="empty-state">{errorMessage}</p>
      ) : (
        <div className="patients-grid">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              isHighlighted={patient.id === highlightedPatientId}
              onViewDetail={onViewPatient}
              patient={patient}
            />
          ))}
        </div>
      )}

      {!isLoading && !errorMessage && filteredPatients.length === 0 && (
        <div className="patients-empty-state" role="status">
          <div aria-hidden="true" className="patients-empty-mark">
            {searchText.trim() ? '?' : '+'}
          </div>
          <div>
            <h3>
              {searchText.trim()
                ? 'No encontramos coincidencias'
                : 'Aún no hay pacientes registrados'}
            </h3>
            <p>
              {searchText.trim()
                ? 'Prueba con el nombre completo, teléfono o email.'
                : emptyMessage}
            </p>
          </div>
          <button
            className="secondary-action"
            type="button"
            onClick={
              searchText.trim() ? () => setSearchText('') : focusPatientForm
            }
          >
            {searchText.trim() ? 'Limpiar búsqueda' : 'Registrar paciente'}
          </button>
        </div>
      )}
    </section>
  )
}
